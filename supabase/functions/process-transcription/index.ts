import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  let supabaseAdmin: SupabaseClient | null = null
  let reqRecordId: string | null = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Corpo da requisicao invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { record_id, audio_url, tenant_id, specialty } = body
    reqRecordId = record_id

    if (!audio_url || typeof audio_url !== 'string' || !audio_url.startsWith('https://')) {
      return new Response(JSON.stringify({ error: 'URL de audio invalida.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!record_id || typeof record_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Identificador invalido ou ausente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!tenant_id || typeof tenant_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Identificador de tenant invalido ou ausente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'

    const { data: dgKeyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'deepgram')
      .eq('status', 'active')
      .maybeSingle()

    if (!dgKeyData) {
      return new Response(JSON.stringify({ error: 'Servico de transcricao nao configurado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

    const { data: existingTx } = await supabaseAdmin
      .from('transcriptions')
      .select('id')
      .eq('record_id', record_id)
      .maybeSingle()

    let transcription_id = existingTx?.id

    if (existingTx) {
      await supabaseAdmin
        .from('transcriptions')
        .update({ status: 'processing', audio_url })
        .eq('id', existingTx.id)
    } else {
      const { data: newTx } = await supabaseAdmin
        .from('transcriptions')
        .insert({
          record_id,
          tenant_id,
          status: 'processing',
          audio_url,
        })
        .select('id')
        .single()
      transcription_id = newTx?.id
    }

    const audioRes = await fetch(audio_url)
    if (!audioRes.ok) {
      if (transcription_id) {
        await supabaseAdmin
          .from('transcriptions')
          .update({ status: 'failed', error_message: 'Falha na leitura do arquivo de audio.' })
          .eq('id', transcription_id)
          .catch(() => null)
      }
      return new Response(JSON.stringify({ error: 'Falha na leitura do arquivo de audio.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const audioBuffer = await audioRes.arrayBuffer()

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
        Authorization: `Token ${deepgramApiKey}`,
        'Content-Type': 'audio/webm',
      },
      body: audioBuffer,
    })

    if (!dgRes.ok) {
      if (transcription_id) {
        await supabaseAdmin
          .from('transcriptions')
          .update({ status: 'failed', error_message: 'Erro no processamento da transcricao.' })
          .eq('id', transcription_id)
          .catch(() => null)
      }
      return new Response(JSON.stringify({ error: 'Erro no processamento da transcricao.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const dgData = await dgRes.json()
    const fullTranscript = dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    const utterances = dgData.results?.utterances || []

    const speaker_segments = utterances.map((u: any) => ({
      speaker: u.speaker,
      text: u.transcript,
      start: u.start,
      end: u.end,
      confidence: u.confidence,
    }))

    const duration_seconds =
      utterances.length > 0 ? Math.round(utterances[utterances.length - 1].end) : 0

    let aiSummary = ''
    let aiSections: any = null

    if (!skipAiProcessing && openaiApiKey) {
      const systemMessage = `Voce e um medico experiente transcrevendo uma consulta em prontuario eletronico SOAP. Especialidade: ${specialty || 'Geral'}. Sua tarefa e extrair TODAS as informacoes clinicas mencionadas na conversa e preencher cada secao de forma completa e detalhada. NAO resuma. NAO omita detalhes. Se o paciente mencionou uma queixa, ela DEVE aparecer na anamnese. Se o medico mencionou um achado, ele DEVE aparecer no exame fisico. Escreva como um prontuario medico real, em linguagem tecnica mas clara. Responda APENAS com JSON valido.`

      let userMessage = `TRANSCRICAO DA CONSULTA:\n\n`
      for (const seg of speaker_segments) {
        const speakerLabel = seg.speaker === 0 ? 'Medico' : 'Paciente'
        userMessage += `${speakerLabel}: ${seg.text}\n`
      }

      userMessage += `\n\nINSTRUCOES DETALHADAS: Analise TODA a transcricao acima. Extraia TODAS as informacoes clinicas mencionadas. Gere um JSON com estas chaves:
'subjective': String OBRIGATORIA. Anamnese completa. DEVE conter: Queixa Principal (QP) com as palavras exatas do paciente entre aspas. Historia da Doenca Atual (HDA) com inicio dos sintomas, evolucao, fatores de melhora e piora, tratamentos ja tentados. Antecedentes pessoais e familiares SE mencionados. Habitos e medicacoes em uso SE mencionados. Revisao de sistemas SE mencionados. Se o paciente falou sobre dor, inclua: localizacao, intensidade, tipo, irradiacao, duracao, frequencia. NUNCA deixe esta secao vazia. Se houver qualquer queixa do paciente na transcricao, ela DEVE estar aqui.
'objective': String. Exame fisico. Inclua TODOS os achados mencionados pelo medico: inspecao, palpacao, ausculta, testes especiais. Sinais vitais SE mencionados (PA, FC, FR, Tax, SpO2, peso, altura). Estado geral do paciente SE descrito. Se o medico nao mencionou exame fisico, escreva 'Exame fisico nao realizado nesta consulta.' NAO deixe vazio.
'assessment': String OBRIGATORIA. Avaliacao medica. DEVE conter: Hipotese diagnostica principal com justificativa clinica baseada nos achados. Diagnosticos diferenciais SE o medico mencionou. Classificacao ou estadiamento SE aplicavel. Codigos CID-10 sugeridos SE possivel inferir. NUNCA escreva apenas 'avaliacao necessaria'. Sempre proponha pelo menos uma hipotese baseada na queixa do paciente.
'plan': String OBRIGATORIA. Conduta terapeutica DETALHADA. DEVE conter: Prescricoes com nome do medicamento, dose, via, posologia e duracao SE mencionadas. Exames solicitados com justificativa. Encaminhamentos SE mencionados. Orientacoes ao paciente. Retorno com prazo. Cada item em linha separada. NUNCA escreva apenas 'recomendar ao paciente'. Seja especifico com base no que foi discutido.
'specialty_fields': Objeto com campos especificos da especialidade. APENAS campos efetivamente discutidos na consulta.
Se especialidade for dermatologia: extraia skin_phototype (fototipo SE mencionado), complaint_area (areas afetadas como face, tronco, membros), lesion_description (descricao detalhada da lesao), procedure_type (procedimentos realizados ou planejados), product_used (produtos usados com nome e fabricante), total_units (unidades totais SE mencionadas), acne_classification (SE acne discutida).
Se especialidade for psiquiatria: extraia mood_reported (humor relatado pelo paciente com palavras exatas), affect_observed (afeto observado pelo medico), thought_content (conteudo do pensamento SE avaliado), suicide_risk (risco suicida SE avaliado, OBRIGATORIO informar se foi perguntado), substance_use (uso de substancias SE mencionado), current_medications (medicacoes psiquiatricas em uso com doses).
Se especialidade for cardiologia: extraia cv_risk_factors (fatores de risco mencionados), ecg_rhythm (ritmo SE ECG discutido), nyha_class (classe funcional SE IC discutida), cardio_medications (medicacoes cardiologicas com doses).
Se especialidade for endocrinologia: extraia hba1c e fasting_glucose SE valores mencionados, tsh e t4l SE mencionados, insulin_therapy SE discutida, bmi_classification SE avaliado.
Se especialidade for ortopedia: extraia affected_region (regioes afetadas com lateralidade D/E), rom (amplitude de movimento SE avaliada), special_tests (testes especiais realizados e resultados), imaging_findings (achados de imagem SE discutidos).
Se especialidade for ginecologia: extraia last_menstrual_period (DUM SE mencionada), contraception (metodo contraceptivo SE discutido), obstetric_history (historia obstetrica SE mencionada).
Se especialidade for oftalmologia: extraia acuidade visual SE mencionada (va_od_sc, va_oe_sc, va_od_cc, va_oe_cc), tonometry_od e tonometry_oe SE PIO medida, biomicroscopy e fundoscopy SE realizados.
Se especialidade for pediatria: extraia weight_percentile e height_percentile SE medidos, development_assessment SE avaliado, feeding_type SE discutido, vaccination_status SE mencionado.
Para qualquer outra especialidade: extraia campos relevantes mencionados na consulta como pares chave-valor.
'summary': String OBRIGATORIA. Resumo de 3 a 5 frases da consulta incluindo: motivo da consulta, principais achados, diagnostico provavel e conduta definida.
REGRAS: 1) NUNCA deixe 'subjective' vazio se o paciente falou qualquer queixa. 2) NUNCA escreva frases genericas como 'avaliacao necessaria' ou 'recomendar ao paciente' sem detalhes. 3) Use linguagem de prontuario medico (ex: 'Paciente refere quadro de cefaleia holocraniana...'). 4) Mantenha cada secao com pelo menos 3 linhas de conteudo. 5) Se uma informacao nao foi mencionada, NAO invente. Mas se foi mencionada, mesmo brevemente, INCLUA.`

      try {
        const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
          }),
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

    if (transcription_id) {
      await supabaseAdmin
        .from('transcriptions')
        .update({
          raw_text: fullTranscript,
          processed_text: aiSummary,
          duration_seconds,
          speaker_segments,
          status: 'completed',
        })
        .eq('id', transcription_id)
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
              await supabaseAdmin
                .from('medical_record_sections')
                .update({
                  content: aiSections[section_type],
                  ai_generated: true,
                  ai_confidence: 0.85,
                })
                .eq('id', existingSec.id)
              sections_updated.push(section_type)
            }
          } else {
            await supabaseAdmin.from('medical_record_sections').insert({
              record_id,
              tenant_id,
              section_type,
              content: aiSections[section_type],
              ai_generated: true,
              ai_confidence: 0.85,
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
          let currentData = (existingSpec.structured_data as any) || {}
          let changed = false
          for (const key in aiSections.specialty_fields) {
            if (
              !currentData[key] ||
              (typeof currentData[key] === 'string' && currentData[key].trim() === '')
            ) {
              currentData[key] = aiSections.specialty_fields[key]
              changed = true
            }
          }
          if (changed) {
            await supabaseAdmin
              .from('medical_record_sections')
              .update({
                structured_data: currentData,
                ai_generated: true,
              })
              .eq('id', existingSpec.id)
            sections_updated.push('specialty_fields')
          }
        } else {
          await supabaseAdmin.from('medical_record_sections').insert({
            record_id,
            tenant_id,
            section_type: 'specialty_fields',
            structured_data: aiSections.specialty_fields,
            ai_generated: true,
            ai_confidence: 0.85,
          })
          sections_updated.push('specialty_fields')
        }
      }
    }

    const uniqueSpeakers = new Set(speaker_segments.map((s: any) => s.speaker))

    return new Response(
      JSON.stringify({
        success: true,
        transcription_id,
        duration_seconds,
        speaker_count: uniqueSpeakers.size,
        segments_count: speaker_segments.length,
        ai_processed: !skipAiProcessing,
        sections_updated,
        message: 'Transcricao processada com sucesso.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('process-transcription error:', error)
    if (supabaseAdmin && reqRecordId) {
      await supabaseAdmin
        .from('transcriptions')
        .update({
          status: 'failed',
          error_message: 'Erro interno. Tente novamente.',
        })
        .eq('record_id', reqRecordId)
        .catch(() => null)
    }
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
