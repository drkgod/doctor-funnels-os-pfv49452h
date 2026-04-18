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

  const url = new URL(req.url)
  const tenant_id = url.searchParams.get('tenant_id')

  try {
    let payload: any
    try {
      payload = await req.json()
    } catch (e) {
      try {
        const text = await req.text()
        payload = JSON.parse(text)
      } catch (err) {
        return new Response('Payload invalido.', { status: 400, headers: corsHeaders })
      }
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return new Response('Payload invalido.', { status: 400, headers: corsHeaders })
    }

    if (!tenant_id || tenant_id.length !== 36) {
      return new Response('Tenant invalido.', { status: 400, headers: corsHeaders })
    }

    const supabaseUrlVar = Deno.env.get('SUPABASE_URL')
    const serviceRoleKeyVar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!serviceRoleKeyVar) {
      console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set')
      return new Response(JSON.stringify({ error: 'Configuracao do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrlVar ?? '', serviceRoleKeyVar ?? '')

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .maybeSingle()

    if (!tenant) {
      return new Response('Tenant nao encontrado.', { status: 404, headers: corsHeaders })
    }

    console.log('Webhook handler started')
    console.log(`Tenant ID: ${tenant_id}`)

    let eventType = 'unknown'
    if (payload.EventType && typeof payload.EventType === 'string') {
      eventType = payload.EventType.toLowerCase()
    } else if (payload.eventType && typeof payload.eventType === 'string') {
      eventType = payload.eventType.toLowerCase()
    } else if (payload.event && typeof payload.event === 'string') {
      eventType = payload.event.toLowerCase()
    }

    console.log(`Event type: ${eventType}`)
    console.log(`Instance: ${payload.instanceName || 'unknown'}`)
    console.log(`Payload keys: ${Object.keys(payload).join(',')}`)

    if (eventType === 'messages') {
      const msg = payload.data

      if (!msg) {
        console.log('No message data in payload')
        return new Response(JSON.stringify({ success: true, message: 'Sem dados de mensagem.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (msg.fromMe === true) {
        console.log('Skipping own message (fromMe)')
        return new Response(
          JSON.stringify({ success: true, message: 'Mensagem propria ignorada.' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      if (msg.isGroup === true) {
        console.log('Skipping group message')
        return new Response(
          JSON.stringify({ success: true, message: 'Mensagem de grupo ignorada.' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      let senderPhone = ''
      const rawChatId = msg.chatid || msg.sender || ''
      if (rawChatId) {
        senderPhone = rawChatId.split('@')[0]
      }

      if (!senderPhone) {
        console.log('Could not extract sender phone')
        return new Response(
          JSON.stringify({ success: false, message: 'Telefone do remetente nao encontrado.' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      let messageContent = msg.text || ''
      if (!messageContent) {
        const mType = (msg.messageType || '').toLowerCase()
        if (mType.includes('image')) messageContent = '[Imagem]'
        else if (mType.includes('video')) messageContent = '[Video]'
        else if (mType.includes('audio') || mType.includes('ptt')) messageContent = '[Audio]'
        else if (mType.includes('document')) messageContent = '[Documento]'
        else if (mType.includes('sticker')) messageContent = '[Figurinha]'
        else if (mType.includes('location')) messageContent = '[Localizacao]'
        else if (mType.includes('contact')) messageContent = '[Contato]'
        else if (mType.includes('reaction')) {
          messageContent = msg.reaction || '[Reacao]'
        } else if (mType.includes('poll')) messageContent = '[Enquete]'
        else messageContent = '[Mensagem]'
      }

      const senderName = msg.senderName || senderPhone
      const externalMessageId = msg.messageid

      let mappedType = 'other'
      const rawType = msg.messageType || ''
      if (rawType === 'conversation' || rawType === 'extendedTextMessage') mappedType = 'text'
      else if (rawType === 'imageMessage') mappedType = 'image'
      else if (rawType === 'videoMessage') mappedType = 'video'
      else if (rawType === 'audioMessage' || rawType === 'pttMessage') mappedType = 'audio'
      else if (rawType === 'documentMessage' || rawType === 'documentWithCaptionMessage')
        mappedType = 'document'
      else if (rawType === 'stickerMessage') mappedType = 'sticker'
      else if (rawType === 'locationMessage' || rawType === 'liveLocationMessage')
        mappedType = 'location'
      else if (rawType === 'contactMessage' || rawType === 'contactsArrayMessage')
        mappedType = 'contact'
      else if (rawType === 'reactionMessage') mappedType = 'reaction'
      else if (rawType === 'pollCreationMessage' || rawType === 'pollUpdateMessage')
        mappedType = 'poll'

      console.log(
        `Processing message from: ${senderPhone} name: ${senderName} type: ${mappedType} content preview: ${messageContent.substring(0, 50)}`,
      )

      const { data: existingConv, error: convQueryError } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('phone_number', senderPhone)
        .maybeSingle()

      if (convQueryError) {
        console.log(`Conversation query error: ${convQueryError.message}`)
      }

      let conversationId = ''

      if (!existingConv) {
        const { data: existingPatient, error: patientQueryError } = await supabaseAdmin
          .from('patients')
          .select('*')
          .eq('tenant_id', tenant_id)
          .eq('phone', senderPhone)
          .maybeSingle()

        if (patientQueryError) {
          console.log(`Patient query error: ${patientQueryError.message}`)
        }

        let patientId = null

        if (!existingPatient) {
          const { data: newPatient, error: patientInsertError } = await supabaseAdmin
            .from('patients')
            .insert({
              tenant_id,
              full_name: senderName,
              phone: senderPhone,
              source: 'whatsapp',
              pipeline_stage: 'lead',
            })
            .select('*')
            .single()

          if (patientInsertError) {
            console.log(`Patient insert error: ${patientInsertError.message}`)
            patientId = null
          } else {
            patientId = newPatient.id
          }
        } else {
          patientId = existingPatient.id
        }

        const { data: newConv, error: newConvError } = await supabaseAdmin
          .from('conversations')
          .insert({
            tenant_id,
            patient_id: patientId,
            patient_name: senderName,
            phone_number: senderPhone,
            status: 'active',
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          })
          .select('*')
          .single()

        if (newConvError) {
          console.log(`Conversation insert error: ${newConvError.message}`)
          return new Response(
            JSON.stringify({ success: false, error: 'Falha ao criar conversa.' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }

        conversationId = newConv.id
        console.log(`New conversation created: ${conversationId}`)
      } else {
        conversationId = existingConv.id

        const { error: convUpdateError } = await supabaseAdmin
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: (existingConv.unread_count || 0) + 1,
          })
          .eq('id', conversationId)

        if (convUpdateError) {
          console.log(`Conversation update error: ${convUpdateError.message}`)
        }
      }

      const { data: newMessage, error: messageError } = await supabaseAdmin
        .from('messages')
        .insert({
          tenant_id,
          conversation_id: conversationId,
          content: messageContent,
          direction: 'inbound',
          sender_type: 'patient',
          message_type: mappedType,
          sender_name: senderName,
          sender_phone: senderPhone,
          uazapi_message_id: externalMessageId,
        })
        .select('*')
        .single()

      if (messageError) {
        console.log(`Message insert error: ${messageError.message}`)
        return new Response(
          JSON.stringify({ success: true, message: 'Conversa atualizada mas mensagem nao salva.' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      console.log(`Message saved: ${newMessage.id}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Mensagem processada',
          conversation_id: conversationId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } else if (eventType === 'connection') {
      let connectionState = ''
      if (payload.instance && payload.instance.status) {
        connectionState = payload.instance.status
      } else if (payload.data && payload.data.state) {
        connectionState = payload.data.state
      }
      connectionState = connectionState.toLowerCase()

      console.log(`Connection event. State: ${connectionState}`)

      if (connectionState === 'connected' || connectionState === 'open') {
        const { data: apikey } = await supabaseAdmin
          .from('tenant_api_keys')
          .select('metadata')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')
          .maybeSingle()

        const existingMetadata = (apikey?.metadata as any) || {}

        const { error } = await supabaseAdmin
          .from('tenant_api_keys')
          .update({
            metadata: {
              ...existingMetadata,
              connected: true,
              instance_status: 'connected',
              connected_at: new Date().toISOString(),
              instance_name: payload.instanceName || '',
              owner_number: payload.owner || '',
            },
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')

        if (error) console.log(`Connection update error: ${error.message}`)
        else console.log('Connection updated: connected')
      } else if (connectionState === 'disconnected' || connectionState === 'close') {
        const { data: apikey } = await supabaseAdmin
          .from('tenant_api_keys')
          .select('metadata')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')
          .maybeSingle()

        const existingMetadata = (apikey?.metadata as any) || {}

        const { error } = await supabaseAdmin
          .from('tenant_api_keys')
          .update({
            metadata: {
              ...existingMetadata,
              connected: false,
              instance_status: 'disconnected',
              disconnected_at: new Date().toISOString(),
            },
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')

        if (error) console.log(`Connection update error: ${error.message}`)
        else console.log('Connection updated: disconnected')
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Evento de conexao processado.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } else if (eventType === 'messages_update') {
      let items = []
      if (Array.isArray(payload.data)) {
        items = payload.data
      } else if (payload.data && typeof payload.data === 'object') {
        items = [payload.data]
      }

      for (const item of items) {
        const keyId = item.key && item.key.id ? item.key.id : item.messageid
        const statusValue =
          item.update && item.update.status !== undefined ? item.update.status : item.status

        let mappedStatus = 'unknown'
        if (typeof statusValue === 'number') {
          if (statusValue === 0) mappedStatus = 'error'
          else if (statusValue === 1) mappedStatus = 'pending'
          else if (statusValue === 2) mappedStatus = 'sent'
          else if (statusValue === 3) mappedStatus = 'delivered'
          else if (statusValue === 4) mappedStatus = 'read'
          else if (statusValue === 5) mappedStatus = 'played'
        } else if (typeof statusValue === 'string') {
          mappedStatus = statusValue
        }

        if (keyId) {
          const { error } = await supabaseAdmin
            .from('messages')
            .update({ delivery_status: mappedStatus })
            .eq('uazapi_message_id', keyId)

          if (error) console.log(`Message status update error: ${error.message}`)
        }
      }

      console.log(`Message status update processed for ${items.length} items`)

      return new Response(JSON.stringify({ success: true, message: 'Status atualizado.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      console.log(`Unhandled event type: ${eventType}`)
      console.log(`Payload preview: ${JSON.stringify(payload).substring(0, 200)}`)

      return new Response(JSON.stringify({ success: true, message: 'Evento recebido.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('handle-uazapi-webhook error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
