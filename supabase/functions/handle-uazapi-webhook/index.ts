import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders: Record<string, string> = {
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

  console.log("Webhook handler started")
  console.log(`SUPABASE_URL present: ${!!Deno.env.get('SUPABASE_URL')}`)
  console.log(`SERVICE_ROLE_KEY present: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)
  console.log(`Tenant ID: ${tenant_id}`)

  try {
    let payload
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

    const isProd = Deno.env.get('ENVIRONMENT') === 'production'

    if (isProd) {
      console.log(`Webhook received for tenant: ${tenant_id}`)
    } else {
      console.log(`UAZAPI Webhook received: ${JSON.stringify(payload).substring(0, 500)}`)
      console.log(`Webhook received for tenant: ${tenant_id}`)
    }

    if (!tenant_id || tenant_id.length !== 36) {
      return new Response('Tenant invalido.', { status: 400, headers: corsHeaders })
    }

    const supabaseUrlVar = Deno.env.get('SUPABASE_URL')
    const serviceRoleKeyVar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log(`supabaseUrlVar truthy: ${!!supabaseUrlVar}`)
    console.log(`serviceRoleKeyVar truthy: ${!!serviceRoleKeyVar}`)

    if (!serviceRoleKeyVar) {
      console.error("CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set")
      return new Response(JSON.stringify({ error: "Configuracao do servidor incompleta." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      supabaseUrlVar ?? '',
      serviceRoleKeyVar ?? '',
    )

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .maybeSingle()

    if (!tenant) {
      return new Response('Tenant nao encontrado.', { status: 404, headers: corsHeaders })
    }

    let eventType = ''
    if (payload.event && typeof payload.event === 'string') eventType = payload.event
    else if (payload.type && typeof payload.type === 'string') eventType = payload.type
    else if (payload.data?.event && typeof payload.data.event === 'string')
      eventType = payload.data.event

    if (eventType === 'messages') {
      let message: any = null
      if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        message = payload.data
      } else if (payload.data && Array.isArray(payload.data) && payload.data.length > 0) {
        message = payload.data[0]
      } else if (
        payload.messages &&
        Array.isArray(payload.messages) &&
        payload.messages.length > 0
      ) {
        message = payload.messages[0]
      } else if (payload.message && typeof payload.message === 'object') {
        message = payload.message
      } else if (payload.remoteJid || payload.from || payload.text) {
        message = payload
      }

      if (message && !message.fromMe && !message.key?.fromMe) {
        const senderPhone =
          message.remoteJid?.split('@')[0] ||
          message.key?.remoteJid?.split('@')[0] ||
          message.from?.split('@')[0] ||
          message.chatId?.split('@')[0]

        const content =
          message.text ||
          message.body ||
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          '[Midia]'

        const messageType = message.messageType || 'text'
        const messageId =
          message.id?.id ||
          (typeof message.id === 'string' ? message.id : null) ||
          message.key?.id ||
          message.messageId

        if (senderPhone) {
          const { data: conv, error: convError } = await supabaseAdmin
            .from('conversations')
            .select('id, is_bot_active, unread_count')
            .eq('tenant_id', tenant_id)
            .eq('phone_number', senderPhone)
            .single()

          console.log(`Conversation query result - found: ${!!conv}`)
          if (convError && convError.code !== 'PGRST116') {
            console.error(`Conversation query error: ${convError.message || JSON.stringify(convError)}`)
          }

          let conversation_id = conv?.id
          let is_bot_active = conv?.is_bot_active

          if (!conv) {
            const { data: patient, error: patientError } = await supabaseAdmin
              .from('patients')
              .insert({
                tenant_id,
                full_name: senderPhone,
                phone: senderPhone,
                source: 'whatsapp',
                pipeline_stage: 'lead',
              })
              .select('id')
              .single()

            if (patientError) {
              console.error(`Patient insert error: ${patientError.message || JSON.stringify(patientError)}`)
            }

            const { data: newConv, error: newConvError } = await supabaseAdmin
              .from('conversations')
              .insert({
                tenant_id,
                patient_id: patient?.id,
                phone_number: senderPhone,
                last_message_at: new Date().toISOString(),
                status: 'active',
                is_bot_active: true,
                unread_count: 1,
              })
              .select('id, is_bot_active')
              .single()

            if (newConvError) {
              console.error(`Conversation insert error: ${newConvError.message || JSON.stringify(newConvError)}`)
              return new Response(JSON.stringify({ success: false, error: 'Falha ao criar conversa.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }

            conversation_id = newConv?.id
            is_bot_active = newConv?.is_bot_active
          } else {
            const { error: updateConvError } = await supabaseAdmin
              .from('conversations')
              .update({
                last_message_at: new Date().toISOString(),
                unread_count: (conv.unread_count || 0) + 1,
              })
              .eq('id', conversation_id)
              
            if (updateConvError) {
              console.error(`Conversation update error: ${updateConvError.message || JSON.stringify(updateConvError)}`)
            }
          }

          if (conversation_id) {
            const { data: msgData, error: msgError } = await supabaseAdmin.from('messages').insert({
              tenant_id,
              conversation_id,
              direction: 'inbound',
              sender_type: 'patient',
              content,
              message_type: messageType,
              uazapi_message_id: messageId,
            })
            
            if (msgError) {
              console.error(`Message insert error: ${msgError.message || JSON.stringify(msgError)}`)
            }
          }

          const { data: botConfigs } = await supabaseAdmin
            .from('bot_configs')
            .select('id')
            .eq('tenant_id', tenant_id)
            .eq('status', 'active')
          if (botConfigs && botConfigs.length > 0 && is_bot_active) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

            fetch(`${supabaseUrl}/functions/v1/bot-process-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                tenant_id,
                conversation_id,
                message_content: content,
              }),
            }).catch((err) => console.error(err))
          }
        }
      }
    } else if (eventType === 'connection') {
      const status = payload.data?.state || payload.state || payload.data?.status || payload.status
      const metadataUpdate: any = { instance_status: status }
      if (status === 'connected' || status === 'open') {
        metadataUpdate.phone_number = payload.data?.phoneNumber || payload.phoneNumber
        metadataUpdate.connected = true
        metadataUpdate.instance_status = 'connected'
        metadataUpdate.connected_at = new Date().toISOString()
      } else if (status === 'disconnected' || status === 'close') {
        metadataUpdate.last_disconnection_reason = payload.data?.reason || payload.reason
        metadataUpdate.connected = false
        metadataUpdate.instance_status = 'disconnected'
        metadataUpdate.disconnected_at = new Date().toISOString()
      }

      const { data: apikey } = await supabaseAdmin
        .from('tenant_api_keys')
        .select('metadata')
        .eq('tenant_id', tenant_id)
        .eq('provider', 'uazapi')
        .single()
      if (apikey) {
        const { error: apiKeyUpdateError } = await supabaseAdmin
          .from('tenant_api_keys')
          .update({
            metadata: { ...(apikey.metadata as any), ...metadataUpdate },
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')
          
        if (apiKeyUpdateError) {
          console.error(`Tenant api keys update error: ${apiKeyUpdateError.message || JSON.stringify(apiKeyUpdateError)}`)
        }
      }

      await supabaseAdmin.from('audit_logs').insert({
        tenant_id,
        action: 'whatsapp_connection_status',
        details: { status },
      })
    } else if (eventType === 'messages_update') {
      const updateData = payload.data || payload
      const statusStr = updateData.status || updateData.update?.status
      const messageId = updateData.id?.id || updateData.id || updateData.key?.id

      if (statusStr && messageId) {
        let deliveryStatus = 'sent'
        const lowerStatus = statusStr.toLowerCase()
        if (
          lowerStatus === 'delivery_ack' ||
          lowerStatus === 'server_ack' ||
          lowerStatus === 'delivered'
        )
          deliveryStatus = 'delivered'
        if (lowerStatus === 'read' || lowerStatus === 'played') deliveryStatus = 'read'
        if (lowerStatus === 'error' || lowerStatus === 'failed') deliveryStatus = 'failed'

        const { error: msgUpdateError } = await supabaseAdmin
          .from('messages')
          .update({ delivery_status: deliveryStatus })
          .eq('uazapi_message_id', messageId)
          
        if (msgUpdateError) {
          console.error(`Message update error: ${msgUpdateError.message || JSON.stringify(msgUpdateError)}`)
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('handle-uazapi-webhook error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
