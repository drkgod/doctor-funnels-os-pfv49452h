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

    const { data: convDataCheck } = await supabaseAdmin
      .from('conversations')
      .select('is_bot_active')
      .eq('id', conversation_id)
      .single()

    if (!convDataCheck || convDataCheck.is_bot_active === false) {
      console.log(`Bot skipped: is_bot_active=false for conversation ${conversation_id}`)
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Bot desativado para esta conversa.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const { count: recentBotMessages } = await supabaseAdmin
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
      .order('created_at', { ascending: false })
      .limit(6)

    let chronoHistory = historyData ? [...historyData].reverse() : []
    if (chronoHistory.length > 0) {
      const lastMsg = chronoHistory[chronoHistory.length - 1]
      if (lastMsg.direction === 'inbound' && lastMsg.content === message_content) {
        chronoHistory.pop()
      }
    }

    let historyAfterGeneric: any[] = []
    let filteredHistory: any[] = []

    if (chronoHistory) {
      historyAfterGeneric = chronoHistory.filter((msg) => {
        const content = msg.content
        if (!content || typeof content !== 'string' || content.trim() === '') {
          return false
        }

        const lowerContent = content.toLowerCase()

        if (msg.sender_type === 'bot') {
          const isGeneric =
            lowerContent.includes('como posso te ajudar') ||
            lowerContent.includes('como posso ajudar') ||
            lowerContent.includes('estou aqui para ajudar') ||
            lowerContent.includes('posso te ajudar') ||
            lowerContent.includes('posso ajudar voce') ||
            lowerContent.includes('em que posso ser util')

          if (isGeneric && content.length < 100) {
            return false
          }
        }
        return true
      })

      filteredHistory = historyAfterGeneric.filter((msg) => {
        const content = msg.content
        const lowerContent = content.toLowerCase()

        const exactMatches = [
          '[audio]',
          '[imagem]',
          '[video]',
          '[figurinha]',
          '[sticker]',
          '[localizacao]',
        ]

        if (exactMatches.includes(lowerContent)) return false
        if (lowerContent === '[documento]') return false

        if (lowerContent.startsWith('[documento:') || lowerContent.startsWith('[contato:')) {
          return false
        }

        if (msg.sender_type === 'bot' && msg.direction === 'outbound') {
          if (
            lowerContent.includes('recebi seu audio') ||
            lowerContent.includes('recebi o seu audio') ||
            lowerContent.includes('mandar por escrito') ||
            lowerContent.includes('enviar por escrito')
          ) {
            return false
          }
        }

        return true
      })
    }

    const messagesArray: any[] = []

    for (const msg of filteredHistory) {
      let role = 'user'
      let content = msg.content
      if (msg.direction === 'outbound') {
        if (msg.sender_type === 'bot') {
          role = 'assistant'
        } else if (msg.sender_type === 'human') {
          role = 'assistant'
          content = `[Atendente humano]: ${content}`
        }
      }
      messagesArray.push({ role, content })
    }

    const fallbackPrompt =
      'Voce e um assistente virtual de uma clinica medica. Seja educado, profissional e objetivo. Responda em portugues. Nao forneca diagnosticos medicos. Ajude com agendamentos, informacoes e duvidas gerais.'
    const useCustomPrompt = botConfig.system_prompt && botConfig.system_prompt.trim().length > 10
    let systemPrompt = useCustomPrompt ? botConfig.system_prompt : fallbackPrompt

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
    let uazapiSent = false

    let finalUserMessage = message_content
    let transformed = false
    const lowerMsg = message_content.toLowerCase()

    if (lowerMsg === '[audio]' || lowerMsg === 'audio') {
      finalUserMessage =
        'O paciente enviou um audio. Como voce nao consegue ouvir audios, peca educadamente para ele enviar a mensagem por escrito.'
      transformed = true
    } else if (lowerMsg === '[imagem]') {
      finalUserMessage = 'O paciente enviou uma imagem. Agradeca e pergunte como pode ajudar.'
      transformed = true
    } else if (lowerMsg === '[video]') {
      finalUserMessage = 'O paciente enviou um video. Agradeca e pergunte como pode ajudar.'
      transformed = true
    } else if (lowerMsg.startsWith('[documento')) {
      finalUserMessage = 'O paciente enviou um documento. Agradeca e pergunte como pode ajudar.'
      transformed = true
    } else if (lowerMsg === '[figurinha]' || lowerMsg === '[sticker]') {
      finalUserMessage = 'O paciente enviou uma figurinha. Responda de forma simpatica.'
      transformed = true
    }

    let reqTemperature = botConfig.temperature ?? 0.7
    let reqMaxTokens = botConfig.max_tokens ?? 1024

    if (model === 'gpt-4o-mini') {
      reqTemperature = Math.max(reqTemperature, 0.7)
      reqMaxTokens = Math.max(reqMaxTokens, 500)
    }

    if (provider === 'openai') {
      const allowedModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
      let modelToUse = model
      if (!modelToUse || !allowedModels.includes(modelToUse)) {
        modelToUse = 'gpt-4o-mini'
      }

      const systemPromptAddition = `\n\nFERRAMENTAS DISPONIVEIS:\nVoce tem acesso a ferramentas para consultar a agenda, agendar consultas, cancelar agendamentos, ver horarios de funcionamento, listar servicos, mover pacientes no pipeline do CRM e transferir para atendente humano.\n\nREGRAS SOBRE FERRAMENTAS:\n1. Use as ferramentas quando o paciente perguntar sobre horarios, agendamentos, servicos ou quando precisar de acoes no sistema.\n2. SEMPRE confirme com o paciente ANTES de agendar ou cancelar. Exemplo: antes de agendar diga 'Posso agendar para quinta dia 23 as 10h?' e so agende depois que o paciente confirmar.\n3. Quando o paciente pedir para agendar sem especificar data e hora, pergunte a preferencia dele primeiro.\n4. Se o paciente pedir algo que voce nao consegue fazer (como receitas, diagnosticos, alteracao de dados pessoais), explique que isso precisa ser feito pelo atendente e ofereca transferir.\n5. Nunca invente horarios disponiveis. SEMPRE use a ferramenta check_availability para verificar antes de sugerir.\n6. Apos agendar, confirme os detalhes completos: data, horario e tipo de consulta.`

      const openaiTools = [
        {
          type: 'function',
          function: {
            name: 'check_availability',
            description:
              'Verifica disponibilidade de horarios para agendamento em uma data especifica. Retorna os horarios livres do dia.',
            parameters: {
              type: 'object',
              properties: {
                date: {
                  type: 'string',
                  description: 'Data para verificar disponibilidade no formato YYYY-MM-DD.',
                },
                doctor_id: {
                  type: 'string',
                  description: 'ID do medico. Se nao fornecido, verifica para todos os medicos.',
                },
              },
              required: ['date'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'book_appointment',
            description: 'Agenda uma consulta para o paciente. Cria o agendamento no sistema.',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'Data da consulta no formato YYYY-MM-DD.' },
                time: { type: 'string', description: 'Horario da consulta no formato HH:MM.' },
                type: {
                  type: 'string',
                  description:
                    'Tipo de consulta. Opcoes: primeira_consulta, retorno, procedimento, avaliacao. Padrao: primeira_consulta.',
                },
                notes: { type: 'string', description: 'Observacoes sobre o agendamento.' },
              },
              required: ['date', 'time'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'cancel_appointment',
            description: 'Cancela um agendamento existente do paciente.',
            parameters: {
              type: 'object',
              properties: {
                appointment_id: {
                  type: 'string',
                  description:
                    'ID do agendamento. Se nao fornecido, cancela o proximo agendamento futuro do paciente.',
                },
              },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_office_hours',
            description: 'Retorna os horarios de funcionamento da clinica.',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'list_services',
            description: 'Lista os tipos de consulta e servicos disponiveis na clinica.',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'move_pipeline',
            description: 'Move o paciente para uma etapa diferente no funil/pipeline do CRM.',
            parameters: {
              type: 'object',
              properties: {
                stage: {
                  type: 'string',
                  description:
                    'Nova etapa do pipeline. Opcoes: lead, contact, scheduled, consultation, return, procedure.',
                },
              },
              required: ['stage'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'transfer_to_human',
            description:
              'Transfere a conversa para um atendente humano. Use quando o paciente pedir para falar com uma pessoa, quando a situacao for complexa demais, ou quando envolver assuntos medicos sensiveis.',
            parameters: {
              type: 'object',
              properties: {
                reason: { type: 'string', description: 'Motivo da transferencia.' },
              },
            },
          },
        },
      ]

      const apiMessages: any[] = []
      apiMessages.push({ role: 'system', content: systemPrompt + systemPromptAddition })
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

      let round = 0
      const MAX_ROUNDS = 3

      while (round < MAX_ROUNDS) {
        const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${decryptedKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: apiMessages,
            temperature: reqTemperature,
            max_tokens: reqMaxTokens,
            tools: openaiTools,
          }),
        })

        if (!oaRes.ok) {
          const errText = await oaRes.text()
          console.error('OpenAI Error HTTP:', oaRes.status, errText)
          return new Response(JSON.stringify({ error: 'Erro ao conectar com servico externo.' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const data = await oaRes.json()
        const message = data.choices?.[0]?.message

        if (message?.tool_calls && message.tool_calls.length > 0) {
          apiMessages.push(message)

          for (const tool_call of message.tool_calls) {
            const functionName = tool_call.function.name
            let args: any = {}
            try {
              args = JSON.parse(tool_call.function.arguments || '{}')
            } catch (e) {}

            console.log(
              `TOOL CALL: name=${functionName} args=${tool_call.function.arguments?.substring(0, 100)}`,
            )
            let result: any = {}

            try {
              if (functionName === 'check_availability') {
                const { date, doctor_id } = args
                if (!date) {
                  result = { error: "Parametro 'date' obrigatorio." }
                } else {
                  const today = new Date().toISOString().split('T')[0]
                  if (date < today) {
                    result = {
                      error: 'Nao e possivel verificar disponibilidade para datas passadas.',
                    }
                  } else {
                    const { data: tenant } = await supabaseAdmin
                      .from('tenants')
                      .select('business_hours')
                      .eq('id', tenant_id)
                      .single()
                    let business_hours: any = tenant?.business_hours
                    if (!business_hours || Object.keys(business_hours).length === 0) {
                      business_hours = {
                        '1': { open: '08:00', close: '18:00', is_open: true },
                        '2': { open: '08:00', close: '18:00', is_open: true },
                        '3': { open: '08:00', close: '18:00', is_open: true },
                        '4': { open: '08:00', close: '18:00', is_open: true },
                        '5': { open: '08:00', close: '18:00', is_open: true },
                        '6': { open: '08:00', close: '12:00', is_open: true },
                        '0': { open: '00:00', close: '00:00', is_open: false },
                      }
                    }
                    const d = new Date(date + 'T12:00:00Z')
                    const dayOfWeek = d.getUTCDay().toString()
                    const dayHours = business_hours[dayOfWeek]

                    if (!dayHours || !dayHours.is_open) {
                      result = { message: 'A clinica esta fechada neste dia.' }
                    } else {
                      const startHour = dayHours.open || '08:00'
                      const endHour = dayHours.close || '18:00'

                      let q = supabaseAdmin
                        .from('appointments')
                        .select('datetime_start, datetime_end')
                        .eq('tenant_id', tenant_id)
                        .gte('datetime_start', `${date}T00:00:00Z`)
                        .lte('datetime_start', `${date}T23:59:59Z`)
                        .neq('status', 'cancelled')
                      if (doctor_id) q = q.eq('doctor_id', doctor_id)
                      const { data: appointments } = await q

                      const available_slots = []
                      let current = new Date(`${date}T${startHour}:00-03:00`)
                      const endSlot = new Date(`${date}T${endHour}:00-03:00`)
                      const now = new Date()

                      while (current < endSlot) {
                        const slotStart = current
                        const slotEnd = new Date(current.getTime() + 30 * 60000)

                        if (slotStart > now) {
                          let overlap = false
                          if (appointments) {
                            for (const appt of appointments) {
                              const apptStart = new Date(appt.datetime_start)
                              const apptEnd = new Date(appt.datetime_end)
                              if (slotStart < apptEnd && slotEnd > apptStart) {
                                overlap = true
                                break
                              }
                            }
                          }
                          if (!overlap) {
                            const hh = slotStart.getHours().toString().padStart(2, '0')
                            const mm = slotStart.getMinutes().toString().padStart(2, '0')
                            available_slots.push(`${hh}:${mm}`)
                          }
                        }
                        current = slotEnd
                      }

                      result = {
                        date,
                        available_slots,
                        booked_count: appointments?.length || 0,
                        total_slots: available_slots.length + (appointments?.length || 0),
                      }
                    }
                  }
                }
              } else if (functionName === 'book_appointment') {
                const { date, time, type, notes } = args
                if (!date || !time) {
                  result = { error: "Parametros 'date' e 'time' obrigatorios." }
                } else {
                  const { data: conv } = await supabaseAdmin
                    .from('conversations')
                    .select('patient_id, phone_number')
                    .eq('id', conversation_id)
                    .single()
                  let patient_id = conv?.patient_id
                  if (!patient_id) {
                    const { data: pat } = await supabaseAdmin
                      .from('patients')
                      .select('id')
                      .eq('tenant_id', tenant_id)
                      .eq('phone', conv?.phone_number)
                      .maybeSingle()
                    if (pat) patient_id = pat.id
                  }

                  if (!patient_id) {
                    result = {
                      error:
                        'Paciente nao encontrado no sistema. O atendente precisa cadastrar o paciente primeiro.',
                    }
                  } else {
                    const slotStart = new Date(`${date}T${time}:00-03:00`)
                    const slotEnd = new Date(slotStart.getTime() + 30 * 60000)

                    const { data: overlapping } = await supabaseAdmin
                      .from('appointments')
                      .select('id')
                      .eq('tenant_id', tenant_id)
                      .neq('status', 'cancelled')
                      .lt('datetime_start', slotEnd.toISOString())
                      .gt('datetime_end', slotStart.toISOString())

                    if (overlapping && overlapping.length > 0) {
                      result = { error: 'Horario indisponivel. Verifique horarios livres.' }
                    } else {
                      const { data: newAppt, error: apptErr } = await supabaseAdmin
                        .from('appointments')
                        .insert({
                          tenant_id,
                          patient_id,
                          datetime_start: slotStart.toISOString(),
                          datetime_end: slotEnd.toISOString(),
                          type: type || 'primeira_consulta',
                          status: 'pending',
                          notes: notes || '',
                        })
                        .select('id')
                        .single()

                      if (apptErr) {
                        result = { error: 'Erro ao criar agendamento.' }
                      } else {
                        const { data: patData } = await supabaseAdmin
                          .from('patients')
                          .select('pipeline_stage')
                          .eq('id', patient_id)
                          .single()
                        if (patData && ['lead', 'contact'].includes(patData.pipeline_stage)) {
                          await supabaseAdmin
                            .from('patients')
                            .update({ pipeline_stage: 'scheduled' })
                            .eq('id', patient_id)
                        }

                        result = {
                          success: true,
                          appointment_id: newAppt?.id,
                          datetime_start: slotStart.toISOString(),
                          datetime_end: slotEnd.toISOString(),
                          message: 'Consulta agendada com sucesso.',
                        }
                      }
                    }
                  }
                }
              } else if (functionName === 'cancel_appointment') {
                const { appointment_id } = args
                let target_id = appointment_id
                let patient_id = null

                if (!target_id) {
                  const { data: conv } = await supabaseAdmin
                    .from('conversations')
                    .select('patient_id, phone_number')
                    .eq('id', conversation_id)
                    .single()
                  patient_id = conv?.patient_id
                  if (!patient_id) {
                    const { data: pat } = await supabaseAdmin
                      .from('patients')
                      .select('id')
                      .eq('tenant_id', tenant_id)
                      .eq('phone', conv?.phone_number)
                      .maybeSingle()
                    if (pat) patient_id = pat.id
                  }

                  if (!patient_id) {
                    result = { error: 'Paciente nao encontrado.' }
                  } else {
                    const { data: upcoming } = await supabaseAdmin
                      .from('appointments')
                      .select('id, datetime_start')
                      .eq('tenant_id', tenant_id)
                      .eq('patient_id', patient_id)
                      .neq('status', 'cancelled')
                      .gt('datetime_start', new Date().toISOString())
                      .order('datetime_start', { ascending: true })
                      .limit(1)
                      .maybeSingle()

                    if (!upcoming) {
                      result = { error: 'Nenhum agendamento futuro encontrado para este paciente.' }
                    } else {
                      target_id = upcoming.id
                    }
                  }
                } else {
                  const { data: appt } = await supabaseAdmin
                    .from('appointments')
                    .select('id')
                    .eq('id', target_id)
                    .eq('tenant_id', tenant_id)
                    .maybeSingle()
                  if (!appt) {
                    result = { error: 'Agendamento nao encontrado.' }
                    target_id = null
                  }
                }

                if (target_id) {
                  await supabaseAdmin
                    .from('appointments')
                    .update({ status: 'cancelled' })
                    .eq('id', target_id)
                  result = { success: true, message: 'Agendamento cancelado.' }
                }
              } else if (functionName === 'get_office_hours') {
                const { data: tenant } = await supabaseAdmin
                  .from('tenants')
                  .select('business_hours')
                  .eq('id', tenant_id)
                  .single()
                let business_hours: any = tenant?.business_hours
                if (!business_hours || Object.keys(business_hours).length === 0) {
                  business_hours = {
                    '1': { open: '08:00', close: '18:00', is_open: true },
                    '2': { open: '08:00', close: '18:00', is_open: true },
                    '3': { open: '08:00', close: '18:00', is_open: true },
                    '4': { open: '08:00', close: '18:00', is_open: true },
                    '5': { open: '08:00', close: '18:00', is_open: true },
                    '6': { open: '08:00', close: '12:00', is_open: true },
                    '0': { open: '00:00', close: '00:00', is_open: false },
                  }
                }
                result = { business_hours }
              } else if (functionName === 'list_services') {
                const { data: appts } = await supabaseAdmin
                  .from('appointments')
                  .select('type')
                  .eq('tenant_id', tenant_id)
                const uniqueTypes = new Set([
                  'primeira_consulta',
                  'retorno',
                  'procedimento',
                  'avaliacao',
                ])
                if (appts) {
                  appts.forEach((a) => {
                    if (a.type) uniqueTypes.add(a.type)
                  })
                }
                result = { services: Array.from(uniqueTypes) }
              } else if (functionName === 'move_pipeline') {
                const { stage } = args
                const validStages = [
                  'lead',
                  'contact',
                  'scheduled',
                  'consultation',
                  'return',
                  'procedure',
                ]
                if (!validStages.includes(stage)) {
                  result = { error: 'Etapa invalida.' }
                } else {
                  const { data: conv } = await supabaseAdmin
                    .from('conversations')
                    .select('patient_id, phone_number')
                    .eq('id', conversation_id)
                    .single()
                  let patient_id = conv?.patient_id
                  if (!patient_id) {
                    const { data: pat } = await supabaseAdmin
                      .from('patients')
                      .select('id')
                      .eq('tenant_id', tenant_id)
                      .eq('phone', conv?.phone_number)
                      .maybeSingle()
                    if (pat) patient_id = pat.id
                  }

                  if (!patient_id) {
                    result = { error: 'Paciente nao encontrado.' }
                  } else {
                    const { data: patBefore } = await supabaseAdmin
                      .from('patients')
                      .select('pipeline_stage, full_name')
                      .eq('id', patient_id)
                      .single()
                    await supabaseAdmin
                      .from('patients')
                      .update({ pipeline_stage: stage })
                      .eq('id', patient_id)
                    result = {
                      success: true,
                      previous_stage: patBefore?.pipeline_stage,
                      new_stage: stage,
                      patient_name: patBefore?.full_name,
                    }
                  }
                }
              } else if (functionName === 'transfer_to_human') {
                const { reason } = args
                await supabaseAdmin
                  .from('conversations')
                  .update({
                    is_bot_active: false,
                    bot_paused_at: new Date().toISOString(),
                    bot_paused_reason: 'transfer_to_human',
                  })
                  .eq('id', conversation_id)

                console.log(`Bot transferred to human. Reason: ${reason}`)
                result = {
                  success: true,
                  message:
                    'Transferindo para um atendente humano. Alguem entrara em contato em breve.',
                }
              } else {
                result = { error: 'Funcao desconhecida.' }
              }
            } catch (e: any) {
              result = { error: 'Erro interno ao processar solicitacao.' }
              console.error(e)
            }

            console.log(
              `TOOL RESULT: name=${functionName} success=${!result.error} result (first 200 chars)=${JSON.stringify(result).substring(0, 200)}`,
            )
            apiMessages.push({
              role: 'tool',
              tool_call_id: tool_call.id,
              content: JSON.stringify(result),
            })
          }
          round++
        } else {
          aiResponseText = message?.content || ''
          break
        }
      }

      if (round >= MAX_ROUNDS && !aiResponseText) {
        aiResponseText =
          'Estou verificando os dados no momento, por favor aguarde um instante e envie sua mensagem novamente.'
      }
      console.log(`TOOL ROUNDS: total=${round}`)
      console.log('OPENAI FINAL RESPONSE LENGTH=' + aiResponseText.length)
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
