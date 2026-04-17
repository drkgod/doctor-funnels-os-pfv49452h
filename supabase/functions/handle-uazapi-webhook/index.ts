import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json().catch(() => null)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return new Response('Payload invalido.', { status: 400, headers: corsHeaders })
    }

    const url = new URL(req.url)
    const tenant_id = url.searchParams.get('tenant_id')

    if (!tenant_id || tenant_id.length !== 36) {
      return new Response('Tenant invalido.', { status: 400, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .maybeSingle()

    if (!tenant) {
      return new Response('Tenant nao encontrado.', { status: 404, headers: corsHeaders })
    }

    if (
      !payload.message &&
      !payload.messages &&
      !payload.event &&
      !payload.status &&
      !payload.data
    ) {
      return new Response('Payload invalido.', { status: 400, headers: corsHeaders })
    }

    const eventType = payload.event

    if (eventType === 'messages') {
      const message = payload.data || payload.message
      if (message && !message.fromMe) {
        const senderPhone = message.remoteJid?.split('@')[0] || message.from
        const content =
          message.text ||
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          '[Mídia]'
        const messageType = message.messageType || 'text'
        const messageId = message.id?.id || message.id

        if (senderPhone) {
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id, is_bot_active, unread_count')
            .eq('tenant_id', tenant_id)
            .eq('phone_number', senderPhone)
            .single()

          let conversation_id = conv?.id
          let is_bot_active = conv?.is_bot_active

          if (!conv) {
            const { data: patient } = await supabaseAdmin
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

            const { data: newConv } = await supabaseAdmin
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

            conversation_id = newConv?.id
            is_bot_active = newConv?.is_bot_active
          } else {
            await supabaseAdmin
              .from('conversations')
              .update({
                last_message_at: new Date().toISOString(),
                unread_count: (conv.unread_count || 0) + 1,
              })
              .eq('id', conversation_id)
          }

          if (conversation_id) {
            await supabaseAdmin.from('messages').insert({
              tenant_id,
              conversation_id,
              direction: 'inbound',
              sender_type: 'patient',
              content,
              message_type: messageType,
              uazapi_message_id: messageId,
            })
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
      const status = payload.data?.state || payload.state
      const metadataUpdate: any = { instance_status: status }
      if (status === 'connected' || status === 'open') {
        metadataUpdate.phone_number = payload.data?.phoneNumber || payload.phoneNumber
      } else if (status === 'disconnected' || status === 'close') {
        metadataUpdate.last_disconnection_reason = payload.data?.reason || payload.reason
      }

      const { data: apikey } = await supabaseAdmin
        .from('tenant_api_keys')
        .select('metadata')
        .eq('tenant_id', tenant_id)
        .eq('provider', 'uazapi')
        .single()
      if (apikey) {
        await supabaseAdmin
          .from('tenant_api_keys')
          .update({
            metadata: { ...(apikey.metadata as any), ...metadataUpdate },
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')
      }

      await supabaseAdmin.from('audit_logs').insert({
        tenant_id,
        action: 'whatsapp_connection_status',
        details: { status },
      })
    } else if (eventType === 'messages_update') {
      const messageUpdate = payload.data || payload
      const messageId = messageUpdate.id?.id || messageUpdate.id
      const statusStr = messageUpdate.status || messageUpdate.update?.status

      let deliveryStatus = 'sent'
      if (statusStr === 'DELIVERY_ACK' || statusStr === 'SERVER_ACK') deliveryStatus = 'delivered'
      if (statusStr === 'READ' || statusStr === 'PLAYED') deliveryStatus = 'read'

      if (messageId) {
        await supabaseAdmin
          .from('messages')
          .update({ delivery_status: deliveryStatus })
          .eq('uazapi_message_id', messageId)
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
