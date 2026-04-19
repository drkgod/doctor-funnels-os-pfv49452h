import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store',
}

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
      return new Response(JSON.stringify({ error: 'Envie os dados no formato JSON.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { tenant_id, conversation_id, message_content } = body

    console.log(
      'BOT INPUT: tenant_id=' +
        tenant_id +
        ' conv_id=' +
        conversation_id +
        ' msg=' +
        (message_content ? message_content.substring(0, 50) : ''),
    )

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

    console.log(
      'BOT CONFIG: found=' +
        !!botConfig +
        ' model=' +
        (botConfig?.model || 'none') +
        ' system_prompt length=' +
        (botConfig?.system_prompt?.length || 0) +
        ' system_prompt first 100 chars=' +
        (botConfig?.system_prompt ? botConfig.system_prompt.substring(0, 100) : 'EMPTY'),
    )

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

    console.log(
      'MODEL: requested=' + botConfig.model + ' resolved=' + model + ' provider=' + provider,
    )

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

    console.log(
      'API KEY: decrypted=' +
        !!decryptedKey +
        ' key_length=' +
        (decryptedKey ? decryptedKey.length : 0) +
        ' starts_with_sk=' +
        (decryptedKey ? decryptedKey.startsWith('sk-') : false),
    )

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
      .order('created_at', { ascending: false })
      .limit(6)

    let chronoHistory = historyData ? [...historyData].reverse() : []
    if (chronoHistory.length > 0) {
      const lastMsg = chronoHistory[chronoHistory.length - 1]
      if (lastMsg.direction === 'inbound' && lastMsg.content === message_content) {
        chronoHistory.pop()
      }
    }

    let filteredHistory: any[] = []

    if (chronoHistory) {
      filteredHistory = chronoHistory.filter((msg) => {
        const content = msg.content
        if (!content || typeof content !== 'string' || content.trim() === '') return false

        const lowerContent = content.toLowerCase()

        const exactMatches = [
          '[audio]',
          '[imagem]',
          '[video]',
          '[documento]',
          '[figurinha]',
          '[localizacao]',
          '[sticker]',
        ]
        if (exactMatches.includes(lowerContent)) return false

        if (lowerContent.startsWith('[documento:')) return false
        if (lowerContent.startsWith('[contato:')) return false

        if (msg.sender_type === 'bot' && msg.direction === 'outbound') {
          if (
            lowerContent.includes('audio') &&
            (lowerContent.includes('escrito') || lowerContent.includes('texto'))
          ) {
            return false
          }
          if (content.startsWith('Recebi seu') || content.startsWith('Recebi o seu')) {
            return false
          }
        }
        return true
      })
      console.log(
        'History filter: original=' +
          chronoHistory.length +
          ' after media filter=' +
          filteredHistory.length,
      )
    }

    const messagesArray: any[] = []

    for (const msg of filteredHistory) {
      let role = 'user'
      if (
        msg.direction === 'outbound' &&
        (msg.sender_type === 'bot' || msg.sender_type === 'human')
      ) {
        role = 'assistant'
      }
      messagesArray.push({ role, content: msg.content })
    }

    const fallbackPrompt =
      'Voce e um assistente virtual de uma clinica medica. Seja educado, profissional e objetivo. Responda em portugues. Nao forneca diagnosticos medicos. Ajude com agendamentos, informacoes e duvidas gerais.'
    const useCustomPrompt = botConfig.system_prompt && botConfig.system_prompt.trim().length > 10
    let systemPrompt = useCustomPrompt ? botConfig.system_prompt : fallbackPrompt

    console.log(
      'PROMPT DECISION: using_custom=' +
        !!useCustomPrompt +
        ' custom_length=' +
        (botConfig.system_prompt ? botConfig.system_prompt.length : 0),
    )
    console.log(
      'SYSTEM PROMPT USED: length=' +
        systemPrompt.length +
        ' first 150 chars=' +
        systemPrompt.substring(0, 150) +
        ' is_fallback=' +
        (systemPrompt === fallbackPrompt),
    )

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
    let wasGeneric = false
    let uazapiSent = false

    let finalUserMessage = message_content
    const lowerMsg = message_content.toLowerCase()
    if (lowerMsg === '[audio]') {
      finalUserMessage =
        'O paciente enviou um audio. Como voce nao consegue ouvir audios, peca educadamente para ele enviar a mensagem por escrito.'
    } else if (lowerMsg === '[imagem]') {
      finalUserMessage = 'O paciente enviou uma imagem. Agradeca e pergunte como pode ajudar.'
    } else if (lowerMsg === '[video]') {
      finalUserMessage = 'O paciente enviou um video. Agradeca e pergunte como pode ajudar.'
    } else if (lowerMsg.startsWith('[documento')) {
      finalUserMessage = 'O paciente enviou um documento. Agradeca e pergunte como pode ajudar.'
    } else if (lowerMsg === '[figurinha]' || lowerMsg === '[sticker]') {
      finalUserMessage = 'O paciente enviou uma figurinha. Responda de forma simpática.'
    }

    let reqTemperature = botConfig.temperature ?? 0.7
    let reqMaxTokens = botConfig.max_tokens ?? 1024

    if (model === 'gpt-4o-mini') {
      reqTemperature = Math.max(reqTemperature, 0.7)
      reqMaxTokens = Math.max(reqMaxTokens, 500)
      console.log(
        'Model adjustment for gpt-4o-mini: temperature=' +
          reqTemperature +
          ' max_tokens=' +
          reqMaxTokens,
      )
    }

    if (provider === 'openai') {
      const allowedModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
      if (!model || !allowedModels.includes(model)) {
        model = 'gpt-4o-mini'
      }

      const apiMessages: any[] = []
      apiMessages.push({ role: 'system', content: systemPrompt })
      apiMessages.push({
        role: 'system',
        content:
          "REGRA OBRIGATORIA: Voce DEVE seguir TODAS as instrucoes acima. Na primeira mensagem de uma conversa, SEMPRE se apresente com seu nome e o nome da clinica ou empresa conforme suas instrucoes. NUNCA responda apenas com frases genericas como 'Como posso te ajudar?' ou 'Estou aqui para ajudar'. Responda de forma personalizada e acolhedora seguindo seu perfil definido acima.",
      })
      if (ragContextMessage) {
        apiMessages.push(ragContextMessage)
      }
      apiMessages.push(...messagesArray)
      apiMessages.push({ role: 'user', content: finalUserMessage })

      let sysCount = 0
      let usrCount = 0
      let astCount = 0
      for (const m of apiMessages) {
        if (m.role === 'system') sysCount++
        if (m.role === 'user') usrCount++
        if (m.role === 'assistant') astCount++
      }
      console.log(
        'API messages final: count=' +
          apiMessages.length +
          ' system_messages=' +
          sysCount +
          ' user_messages=' +
          usrCount +
          ' assistant_messages=' +
          astCount,
      )

      for (let i = 0; i < apiMessages.length; i++) {
        console.log(
          'MSG ' +
            i +
            ': role=' +
            apiMessages[i].role +
            ' content (first 80 chars)=' +
            (apiMessages[i].content ? apiMessages[i].content.substring(0, 80) : ''),
        )
      }

      console.log(
        'OpenAI fetch: model=' + model + ' url=https://api.openai.com/v1/chat/completions',
      )
      console.log(
        'OPENAI REQUEST: model=' +
          model +
          ' messages_count=' +
          apiMessages.length +
          ' system_prompt_in_messages=' +
          (apiMessages[0]?.role === 'system') +
          ' temperature=' +
          reqTemperature +
          ' max_tokens=' +
          reqMaxTokens,
      )
      console.log(
        'SYSTEM MSG CONTENT (first 200 chars): ' +
          (apiMessages[0]?.content ? apiMessages[0].content.substring(0, 200) : ''),
      )

      const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${decryptedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: apiMessages,
          temperature: reqTemperature,
          max_tokens: reqMaxTokens,
        }),
      })

      if (!oaRes.ok) {
        const errText = await oaRes.text()
        console.log('OPENAI ERROR: status=' + oaRes.status + ' body=' + errText.substring(0, 500))
        console.error('OpenAI Error HTTP:', oaRes.status)
        return new Response(JSON.stringify({ error: 'Erro ao conectar com servico externo.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const data = await oaRes.json()
      aiResponseText = data.choices?.[0]?.message?.content || ''
      console.log(
        'OPENAI RESPONSE: status=' +
          oaRes.status +
          ' choices_count=' +
          (data.choices ? data.choices.length : 0) +
          ' response_text_length=' +
          aiResponseText.length +
          ' response_text (first 200 chars)=' +
          aiResponseText.substring(0, 200),
      )
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

        console.log('UAZAPI SEND: status=' + uazapiRes.status + ' response_sent=' + uazapiRes.ok)

        if (uazapiRes.ok) {
          uazapiSent = true
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

    console.log(
      'BOT SUMMARY: tenant=' +
        (tenant_id ? tenant_id.substring(0, 8) : '') +
        ' model=' +
        model +
        ' prompt_length=' +
        systemPrompt.length +
        ' history_used=' +
        messagesArray.length +
        ' rag_used=' +
        !!ragContextMessage +
        ' response_length=' +
        aiResponseText.length +
        ' was_generic=' +
        wasGeneric +
        ' uazapi_sent=' +
        uazapiSent,
    )

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
