import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Corpo da requisicao invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { tenant_id, conversation_id, message_content } = body

    if (
      typeof tenant_id !== 'string' ||
      tenant_id.length !== 36 ||
      typeof conversation_id !== 'string' ||
      conversation_id.length !== 36 ||
      typeof message_content !== 'string' ||
      message_content.trim() === '' ||
      message_content.length > 10000
    ) {
      return new Response(JSON.stringify({ error: 'Dados invalidos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const { count: recentBotMessages, error: countError } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'bot')
      .gte('created_at', oneMinuteAgo)

    if ((recentBotMessages ?? 0) > 5) {
      return new Response(JSON.stringify({ skipped: true, message: 'Limite atingido. Aguarde.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: botConfig } = await supabaseAdmin
      .from('bot_configs')
      .select('id, model, system_prompt, temperature, max_tokens, rag_enabled, status')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .maybeSingle()

    if (!botConfig) {
      return new Response(
        JSON.stringify({ skipped: true, message: 'Servico desativado no momento.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const model = botConfig.model || 'gpt-4o'
    let provider = 'openai'
    if (model.startsWith('claude')) {
      provider = 'anthropic'
    }

    const { data: apiKeyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', tenant_id)
      .eq('provider', provider)
      .maybeSingle()

    if (!apiKeyData) {
      return new Response(
        JSON.stringify({ skipped: true, message: 'Servico de IA nao configurado.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'
    const { data: decryptedKey, error: decryptError } = await supabaseAdmin.rpc('decrypt_api_key', {
      encrypted_value: apiKeyData.encrypted_key,
      secret_key: secretKey,
    })

    if (decryptError || !decryptedKey) {
      return new Response(JSON.stringify({ error: 'Erro ao processar configuracoes.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: historyData } = await supabaseAdmin
      .from('messages')
      .select('direction, sender_type, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20)

    const messagesArray: any[] = []

    if (historyData) {
      for (const msg of historyData) {
        let role = 'user'
        if (
          msg.direction === 'outbound' &&
          (msg.sender_type === 'bot' || msg.sender_type === 'human')
        ) {
          role = 'assistant'
        }
        messagesArray.push({ role, content: msg.content })
      }
    }

    let systemPrompt =
      botConfig.system_prompt ||
      'Voce e um assistente virtual de uma clinica medica. Seja educado, profissional e objetivo. Responda em portugues. Nao forneca diagnosticos medicos. Ajude com agendamentos, informacoes e duvidas gerais.'

    let ragContextMessage: any = null
    if (botConfig.rag_enabled) {
      try {
        const { data: ragData, error: ragError } = await supabaseAdmin.rpc('match_embeddings', {
          query_text: message_content,
          match_threshold: 0.7,
          match_count: 5,
          bot_id: botConfig.id,
        })

        if (!ragError && ragData && ragData.length > 0) {
          const contents = ragData.map((r: any) => r.content).join('\n\n')
          ragContextMessage = {
            role: 'system',
            content: `Contexto relevante da base de conhecimento:\n${contents}`,
          }
        }
      } catch (e) {
        console.warn('RAG Context info issue handled silently')
      }
    }

    let aiResponseText = ''

    if (provider === 'openai') {
      const apiMessages = [{ role: 'system', content: systemPrompt }]
      if (ragContextMessage) {
        apiMessages.push(ragContextMessage)
      }
      apiMessages.push(...messagesArray)

      const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${decryptedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: apiMessages,
          temperature: botConfig.temperature ?? 0.7,
          max_tokens: botConfig.max_tokens ?? 1024,
        }),
      })

      if (!oaRes.ok) {
        console.error('OpenAI Error HTTP:', oaRes.status)
        return new Response(JSON.stringify({ error: 'Erro ao conectar com servico externo.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const data = await oaRes.json()
      aiResponseText = data.choices?.[0]?.message?.content || ''
    } else if (provider === 'anthropic') {
      let anthropicModel = model
      if (model === 'claude-sonnet') anthropicModel = 'claude-sonnet-4-20250514'
      if (model === 'claude-haiku') anthropicModel = 'claude-haiku-4-20250514'

      let finalSystemPrompt = systemPrompt
      if (ragContextMessage) {
        finalSystemPrompt += `\n\n${ragContextMessage.content}`
      }

      const antRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': decryptedKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: botConfig.max_tokens ?? 1024,
          system: finalSystemPrompt,
          messages: messagesArray,
        }),
      })

      if (!antRes.ok) {
        console.error('Anthropic Error HTTP:', antRes.status)
        return new Response(JSON.stringify({ error: 'Erro ao conectar com servico externo.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const data = await antRes.json()
      aiResponseText = data.content?.[0]?.text || ''
    }

    if (!aiResponseText) {
      aiResponseText = 'Desculpe, nao consegui processar sua solicitacao no momento.'
    }

    const { data: newMsg, error: newMsgErr } = await supabaseAdmin
      .from('messages')
      .insert({
        tenant_id,
        conversation_id,
        direction: 'outbound',
        sender_type: 'bot',
        content: aiResponseText,
        message_type: 'text',
      })
      .select('id')
      .single()

    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation_id)

    const { data: convData } = await supabaseAdmin
      .from('conversations')
      .select('phone_number')
      .eq('id', conversation_id)
      .single()

    const { data: uazapiKeyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key, metadata')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'uazapi')
      .maybeSingle()

    if (uazapiKeyData) {
      const { data: uazapiDecryptedKey } = await supabaseAdmin.rpc('decrypt_api_key', {
        encrypted_value: uazapiKeyData.encrypted_key,
        secret_key: secretKey,
      })

      const subdomain = (uazapiKeyData.metadata as any)?.subdomain
      if (uazapiDecryptedKey && subdomain && convData?.phone_number) {
        const uazapiRes = await fetch(`https://${subdomain}.uazapi.com/send/text`, {
          method: 'POST',
          headers: {
            token: uazapiDecryptedKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: convData.phone_number,
            text: aiResponseText,
            readchat: true,
          }),
        })

        if (uazapiRes.ok) {
          const uazapiData = await uazapiRes.json()
          const msgId = uazapiData.messageId || uazapiData.id || `bot_mock_${Date.now()}`
          if (newMsg?.id) {
            await supabaseAdmin
              .from('messages')
              .update({
                uazapi_message_id: msgId,
                delivery_status: 'sent',
              })
              .eq('id', newMsg.id)
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, response_length: aiResponseText.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('bot-process-message error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
