import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const localCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: localCorsHeaders })
  }

  let supabaseAdmin: SupabaseClient | null = null
  let reqRecordId: string | null = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), {
        status: 401,
        headers: { ...localCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), {
        status: 401,
        headers: { ...localCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { record_id, audio_url, tenant_id, specialty } = body
    reqRecordId = record_id

    if (!record_id) return new Response(JSON.stringify({ error: 'record_id obrigatorio' }), { status: 400, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } })
    if (!audio_url) return new Response(JSON.stringify({ error: 'audio_url obrigatorio' }), { status: 400, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } })
    if (!tenant_id) return new Response(JSON.stringify({ error: 'tenant_id obrigatorio' }), { status: 400, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } })

    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'

    // Step 1: Fetch and Decrypt Tenant API Keys
    const { data: dgKeyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'deepgram')
      .eq('status', 'active')
      .maybeSingle()

    if (!dgKeyData) {
      return new Response(
        JSON.stringify({ error: 'Chave Deepgram nao configurada para este tenant. Solicite ao administrador.' }),
        { status: 400, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: deepgramApiKey } = await supabaseAdmin.rpc('decrypt_api_key', {
      encrypted_value: dgKeyData.encrypted_key,
      secret_key: ENCRYPTION_KEY,
    })

    let openaiApiKey = null
    let skipAiProcessing = false

    const { data: oaKeyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'openai')
      .eq('status', 'active')
      .maybeSingle()

    if (!oaKeyData) {
      skipAiProcessing = true
    } else {
      const { data: oaDec } = await supabaseAdmin.rpc('decrypt_api_key', {
        encrypted_value: oaKeyData.encrypted_key,
        secret_key: ENCRYPTION_KEY,
      })
      if (oaDec) {
        openaiApiKey = oaDec
      } else {
        skipAiProcessing = true
      }
    }

    // Step 2: Update Transcription Status
    const { data: existingTx } = await supabaseAdmin
      .from('transcriptions')
      .select('id')
      .eq('record_id', record_id)
      .maybeSingle()

    let transcription_id = existingTx?.id

    if (existingTx) {
      await supabaseAdmin.from('transcriptions').update({ status: 'processing', audio_url }).eq('id', existingTx.id)
    } else {
      const { data: newTx } = await supabaseAdmin.from('transcriptions').insert({
        record_id,
        tenant_id,
        status: 'processing',
        audio_url
      }).select('id').single()
      transcription_id = newTx?.id
    }

    // Step 3: Download Audio
    const audioRes = await fetch(audio_url)
    if (!audioRes.ok) {
      if (transcription_id) {
        await supabaseAdmin.from('transcriptions').update({ status: 'failed', error_message: 'Erro ao baixar audio do armazenamento.' }).eq('id', transcription_id)
      }
      return new Response(JSON.stringify({ error: 'Erro ao baixar audio.' }), { status: 500, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } })
    }
    const audioBuffer = await audioRes.arrayBuffer()

    // Step 4: Deepgram Transcription
    const dgUrl = new URL('https://api.deepgram.com/v1/listen')
    dgUrl.searchParams.set('model', 'nova-3')
    dgUrl.searchParams.set('language', 'pt-BR')
    dgUrl.searchParams.set('diarize', 'true')
    dgUrl.searchParams.set('utterances', 'true')
    dgUrl.searchParams.set('punctuate', 'true')
    dgUrl.searchParams.set('smart_format', 'true')
    dgUrl.searchParams.set('paragraphs', 'true')

    const dgRes = await fetch(dgUrl.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'audio/webm'
      },
      body: audioBuffer
    })

    if (!dgRes.ok) {
      if (transcription_id) {
        await supabaseAdmin.from('transcriptions').update({ status: 'failed', error_message: 'Erro na transcricao de audio. Verifique a chave Deepgram.' }).eq('id', transcription_id)
      }
      return new Response(JSON.stringify({ error: 'Erro na transcricao de audio. Verifique a chave Deepgram.' }), { status: 500, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } })
    }

    const dgData = await dgRes.json()
    const fullTranscript = dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    const utterances = dgData.results?.utterances || []

    const speaker_segments = utterances.map((u: any) => ({
      speaker: u.speaker,
      text: u.transcript,
      start: u.start,
      end: u.end,
      confidence: u.confidence
    }))

    const duration_seconds = utterances.length > 0 ? Math.round(utterances[utterances.length - 1].end) : 0

    // Step 5: OpenAI SOAP Processing (skip if skipAiProcessing is true)
    let aiSummary = ''
    let aiSections: any = null

    if (!skipAiProcessing && openaiApiKey) {
      const systemMessage = `Voce e um assistente medico especializado em prontuarios. A especialidade desta consulta e: ${specialty || 'Geral'}. Analise a transcricao e extraia informacoes em formato SOAP. Responda APENAS com JSON valido.`
      
      let userMessage = `TRANSCRICAO DA CONSULTA:\n\n`
      for (const seg of speaker_segments) {
        const speakerLabel = seg.speaker === 0 ? 'Medico' : 'Paciente'
        userMessage += `${speakerLabel}: ${seg.text}\n`
      }
      
      userMessage += `\n\nGere um JSON com estas chaves: 'subjective' (string: anamnese, queixa principal, HDA, antecedentes), 'objective' (string: exame fisico, sinais vitais mencionados), 'assessment' (string: hipotese diagnostica, avaliacao), 'plan' (string: conduta, prescricoes, exames solicitados, orientacoes), 'specialty_fields' (objeto com campos especificos da especialidade mencionados na conversa, por exemplo para dermatologia: skin_phototype, complaint_area, procedure_type, product_used, total_units. Para psiquiatria: mood_reported, affect_observed, suicide_risk. Inclua APENAS campos efetivamente discutidos.), 'summary' (string: resumo da consulta em 1 paragrafo).`

      try {
        const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 4000,
            response_format: { type: 'json_object' }
          })
        })

        if (oaRes.ok) {
          const oaData = await oaRes.json()
          const contentStr = oaData.choices?.[0]?.message?.content || '{}'
          aiSections = JSON.parse(contentStr)
          aiSummary = aiSections.summary || ''
        } else {
          skipAiProcessing = true
        }
      } catch (e) {
        skipAiProcessing = true
      }
    }

    // Step 6: Save Results
    if (transcription_id) {
      await supabaseAdmin.from('transcriptions').update({
        raw_text: fullTranscript,
        processed_text: aiSummary,
        duration_seconds,
        speaker_segments,
        status: 'completed'
      }).eq('id', transcription_id)
    }

    const sections_updated: string[] = []

    if (!skipAiProcessing && aiSections) {
      const basicSections = ['subjective', 'objective', 'assessment', 'plan']
      for (const section_type of basicSections) {
        if (aiSections[section_type]) {
          const { data: existingSec } = await supabaseAdmin
            .from('medical_record_sections')
            .select('id, content')
            .eq('record_id', record_id)
            .eq('section_type', section_type)
            .maybeSingle()

          if (existingSec) {
            if (!existingSec.content || existingSec.content.trim() === '') {
              await supabaseAdmin.from('medical_record_sections').update({
                content: aiSections[section_type],
                ai_generated: true,
                ai_confidence: 0.85
              }).eq('id', existingSec.id)
              sections_updated.push(section_type)
            }
          } else {
            await supabaseAdmin.from('medical_record_sections').insert({
              record_id,
              tenant_id,
              section_type,
              content: aiSections[section_type],
              ai_generated: true,
              ai_confidence: 0.85
            })
            sections_updated.push(section_type)
          }
        }
      }

      if (aiSections.specialty_fields && Object.keys(aiSections.specialty_fields).length > 0) {
        const { data: existingSpec } = await supabaseAdmin
          .from('medical_record_sections')
          .select('id, structured_data')
          .eq('record_id', record_id)
          .eq('section_type', 'specialty_fields')
          .maybeSingle()

        if (existingSpec) {
          let currentData = existingSpec.structured_data as any || {}
          let changed = false
          for (const key in aiSections.specialty_fields) {
            if (!currentData[key] || (typeof currentData[key] === 'string' && currentData[key].trim() === '')) {
              currentData[key] = aiSections.specialty_fields[key]
              changed = true
            }
          }
          if (changed) {
            await supabaseAdmin.from('medical_record_sections').update({
              structured_data: currentData,
              ai_generated: true
            }).eq('id', existingSpec.id)
            sections_updated.push('specialty_fields')
          }
        } else {
          await supabaseAdmin.from('medical_record_sections').insert({
            record_id,
            tenant_id,
            section_type: 'specialty_fields',
            structured_data: aiSections.specialty_fields,
            ai_generated: true,
            ai_confidence: 0.85
          })
          sections_updated.push('specialty_fields')
        }
      }
    }

    // Step 7: Return Response
    const uniqueSpeakers = new Set(speaker_segments.map((s: any) => s.speaker))

    return new Response(JSON.stringify({
      success: true,
      transcription_id,
      duration_seconds,
      speaker_count: uniqueSpeakers.size,
      segments_count: speaker_segments.length,
      ai_processed: !skipAiProcessing,
      sections_updated,
      message: 'Transcricao processada com sucesso.'
    }), { status: 200, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error(error.message, error.stack)
    if (supabaseAdmin && reqRecordId) {
      await supabaseAdmin.from('transcriptions').update({
        status: 'failed',
        error_message: 'Erro interno ao processar transcricao.'
      }).eq('record_id', reqRecordId)
    }
    return new Response(JSON.stringify({ error: 'Erro ao processar transcricao. Tente novamente.' }), { status: 500, headers: { ...localCorsHeaders, 'Content-Type': 'application/json' } })
  }
})
