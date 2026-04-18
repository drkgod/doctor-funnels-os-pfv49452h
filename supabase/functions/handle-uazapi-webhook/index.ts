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

    console.log("Webhook handler started")
    console.log(`Tenant ID: ${tenant_id}`)
    console.log(`Payload EventType: ${payload.EventType || 'not set'}`)
    console.log(`Payload keys: ${Object.keys(payload).join(',')}`)
    console.log(`Full payload (truncated): ${JSON.stringify(payload).substring(0, 500)}`)

    if (!tenant_id || tenant_id.length !== 36) {
      return new Response('Tenant invalido.', { status: 400, headers: corsHeaders })
    }

    const supabaseUrlVar = Deno.env.get('SUPABASE_URL')
    const serviceRoleKeyVar = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log(`SUPABASE_URL present: ${!!supabaseUrlVar}`)
    console.log(`SERVICE_ROLE_KEY present: ${!!serviceRoleKeyVar}`)

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

    let eventType = 'unknown'
    if (payload.EventType && typeof payload.EventType === 'string') {
      eventType = payload.EventType.toLowerCase()
    } else if (payload.eventType && typeof payload.eventType === 'string') {
      eventType = payload.eventType.toLowerCase()
    } else if (payload.event && typeof payload.event === 'string') {
      eventType = payload.event.toLowerCase()
    } else if (payload.type && typeof payload.type === 'string') {
      eventType = payload.type.toLowerCase()
    }

    console.log(`Event type detected: ${eventType}`)

    if (eventType === 'connection') {
      let connectionState = ''
      if (payload.instance && payload.instance.status) {
        connectionState = payload.instance.status
      } else if (payload.data && payload.data.state) {
        connectionState = payload.data.state
      } else if (payload.state) {
        connectionState = payload.state
      }

      connectionState = connectionState.toLowerCase()

      if (connectionState === 'connected' || connectionState === 'open') {
        const { data: apikey } = await supabaseAdmin
          .from('tenant_api_keys')
          .select('metadata')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')
          .maybeSingle()

        const existingMetadata = (apikey?.metadata as any) || {}
        
        const { error: updateError } = await supabaseAdmin
          .from('tenant_api_keys')
          .update({
            metadata: {
              ...existingMetadata,
              connected: true,
              instance_status: 'connected',
              connected_at: new Date().toISOString(),
              instance_name: payload.instanceName || payload.instance?.name,
              owner_number: payload.owner
            }
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')

        if (updateError) {
          console.error(`Connection update error: ${updateError.message || JSON.stringify(updateError)}`)
        }
      } else if (connectionState === 'disconnected' || connectionState === 'close') {
        const { data: apikey } = await supabaseAdmin
          .from('tenant_api_keys')
          .select('metadata')
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')
          .maybeSingle()

        const existingMetadata = (apikey?.metadata as any) || {}

        const { error: updateError } = await supabaseAdmin
          .from('tenant_api_keys')
          .update({
            metadata: {
              ...existingMetadata,
              connected: false,
              instance_status: 'disconnected',
              disconnected_at: new Date().toISOString()
            }
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')

        if (updateError) {
          console.error(`Connection update error: ${updateError.message || JSON.stringify(updateError)}`)
        }
      }

      console.log(`Connection event processed. State: ${connectionState}`)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else if (eventType === 'messages') {
      let messageData: any = null
      if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        messageData = payload.data
      } else if (payload.data && Array.isArray(payload.data) && payload.data.length > 0) {
        messageData = payload.data[0]
      } else if (payload.message && typeof payload.message === 'object') {
        messageData = payload.message
      } else {
        messageData = payload
      }

      let senderPhone = ''
      if (messageData.key && messageData.key.remoteJid) {
        senderPhone = messageData.key.remoteJid.split('@')[0]
      } else if (messageData.remoteJid) {
        senderPhone = messageData.remoteJid.split('@')[0]
      } else if (messageData.from) {
        senderPhone = messageData.from.split('@')[0]
      } else if (payload.owner) {
        senderPhone = payload.owner.split('@')[0]
      }

      console.log(`Sender phone: ${senderPhone}`)

      const isFromMe = (messageData.key && messageData.key.fromMe === true) || messageData.fromMe === true
      if (isFromMe) {
        console.log("Skipping own message")
        return new Response(JSON.stringify({ success: true, message: 'Mensagem propria ignorada.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let messageContent = ''
      if (messageData.message && messageData.message.conversation && typeof messageData.message.conversation === 'string' && messageData.message.conversation.length > 0) {
        messageContent = messageData.message.conversation
      } else if (messageData.message && messageData.message.extendedTextMessage && messageData.message.extendedTextMessage.text) {
        messageContent = messageData.message.extendedTextMessage.text
      } else if (messageData.body) {
        messageContent = messageData.body
      } else if (messageData.text) {
        messageContent = messageData.text
      } else if (messageData.message && messageData.message.imageMessage) {
        const caption = messageData.message.imageMessage.caption
        messageContent = caption ? caption : '[Imagem]'
      } else if (messageData.message && messageData.message.videoMessage) {
        const caption = messageData.message.videoMessage.caption
        messageContent = caption ? caption : '[Video]'
      } else if (messageData.message && (messageData.message.audioMessage || messageData.message.pttMessage)) {
        messageContent = '[Audio]'
      } else if (messageData.message && (messageData.message.documentMessage || messageData.message.documentWithCaptionMessage)) {
        const docMsg = messageData.message.documentMessage || messageData.message.documentWithCaptionMessage?.message?.documentMessage || messageData.message.documentWithCaptionMessage
        const fileName = docMsg?.fileName
        messageContent = fileName ? `[Documento: ${fileName}]` : '[Documento]'
      } else if (messageData.message && messageData.message.stickerMessage) {
        messageContent = '[Figurinha]'
      } else if (messageData.message && (messageData.message.locationMessage || messageData.message.liveLocationMessage)) {
        messageContent = '[Localizacao]'
      } else if (messageData.message && messageData.message.contactMessage) {
        const displayName = messageData.message.contactMessage.displayName
        messageContent = displayName ? `[Contato: ${displayName}]` : '[Contato]'
      } else if (messageData.message && messageData.message.reactionMessage) {
        const text = messageData.message.reactionMessage.text
        messageContent = text ? text : '[Reacao]'
      } else if (messageData.message && (messageData.message.pollCreationMessage || messageData.message.pollUpdateMessage)) {
        messageContent = '[Enquete]'
      } else {
        messageContent = '[Mensagem]'
      }

      console.log(`Message content: ${messageContent.substring(0, 100)}`)

      let senderName = senderPhone
      if (messageData.pushName) senderName = messageData.pushName
      else if (messageData.senderName) senderName = messageData.senderName
      else if (messageData.notify) senderName = messageData.notify

      let externalMessageId = null
      if (messageData.key && messageData.key.id) externalMessageId = messageData.key.id
      else if (typeof messageData.id === 'string') externalMessageId = messageData.id
      else if (messageData.messageId) externalMessageId = messageData.messageId

      let rawMessageType = 'unknown'
      if (messageData.messageType) {
        rawMessageType = messageData.messageType
      } else if (messageData.message) {
        if (messageData.message.conversation) rawMessageType = 'conversation'
        else if (messageData.message.extendedTextMessage) rawMessageType = 'extendedTextMessage'
        else if (messageData.message.imageMessage) rawMessageType = 'imageMessage'
        else if (messageData.message.videoMessage) rawMessageType = 'videoMessage'
        else if (messageData.message.audioMessage) rawMessageType = 'audioMessage'
        else if (messageData.message.documentMessage) rawMessageType = 'documentMessage'
        else if (messageData.message.stickerMessage) rawMessageType = 'stickerMessage'
        else if (messageData.message.locationMessage) rawMessageType = 'locationMessage'
        else if (messageData.message.contactMessage) rawMessageType = 'contactMessage'
        else if (messageData.message.reactionMessage) rawMessageType = 'reactionMessage'
        else if (messageData.message.pollCreationMessage) rawMessageType = 'pollCreationMessage'
        else if (messageData.message.documentWithCaptionMessage) rawMessageType = 'documentWithCaptionMessage'
        else if (messageData.message.pttMessage) rawMessageType = 'pttMessage'
        else if (messageData.message.liveLocationMessage) rawMessageType = 'liveLocationMessage'
        else if (messageData.message.contactsArrayMessage) rawMessageType = 'contactsArrayMessage'
        else if (messageData.message.pollUpdateMessage) rawMessageType = 'pollUpdateMessage'
      }

      let mappedMessageType = 'other'
      if (['conversation', 'extendedTextMessage', 'text'].includes(rawMessageType)) mappedMessageType = 'text'
      else if (['imageMessage', 'image'].includes(rawMessageType)) mappedMessageType = 'image'
      else if (['videoMessage', 'video'].includes(rawMessageType)) mappedMessageType = 'video'
      else if (['audioMessage', 'pttMessage', 'audio'].includes(rawMessageType)) mappedMessageType = 'audio'
      else if (['documentMessage', 'documentWithCaptionMessage', 'document'].includes(rawMessageType)) mappedMessageType = 'document'
      else if (['stickerMessage', 'sticker'].includes(rawMessageType)) mappedMessageType = 'sticker'
      else if (['locationMessage', 'liveLocationMessage', 'location'].includes(rawMessageType)) mappedMessageType = 'location'
      else if (['contactMessage', 'contactsArrayMessage', 'contact'].includes(rawMessageType)) mappedMessageType = 'contact'
      else if (['reactionMessage', 'reaction'].includes(rawMessageType)) mappedMessageType = 'reaction'
      else if (['pollCreationMessage', 'pollUpdateMessage', 'poll'].includes(rawMessageType)) mappedMessageType = 'poll'

      console.log(`Raw type: ${rawMessageType}`)
      console.log(`Mapped type: ${mappedMessageType}`)

      let messageType = mappedMessageType

      let mediaUrl = messageData.mediaUrl || messageData.media_url
      let mediaMimetype = messageData.mediaMimetype || messageData.media_mimetype
      let mediaSize = messageData.mediaSize || messageData.media_size
      let mediaFilename = messageData.mediaFilename || messageData.fileName || messageData.media_filename
      let latitude = null
      let longitude = null

      if (messageType === 'location') {
        latitude = messageData.latitude || messageData.degreesLatitude || null
        longitude = messageData.longitude || messageData.degreesLongitude || null
      }

      let permanentMediaUrl = mediaUrl

      if (mediaUrl) {
        try {
          const { data: apikey } = await supabaseAdmin
            .from('tenant_api_keys')
            .select('encrypted_key, metadata')
            .eq('tenant_id', tenant_id)
            .eq('provider', 'uazapi')
            .maybeSingle()
          
          if (apikey) {
            const secret = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
            const { data: decryptedToken } = await supabaseAdmin.rpc('decrypt_api_key', {
              encrypted_value: apikey.encrypted_key,
              secret_key: secret,
            })

            const subdomain = (apikey.metadata as any)?.subdomain || Deno.env.get('WHATSAPP_SUBDOMAIN')

            if (decryptedToken && subdomain && externalMessageId) {
              const downloadCtrl = new AbortController()
              const timeoutId = setTimeout(() => downloadCtrl.abort(), 10000)
              
              const downloadRes = await fetch(`https://${subdomain}.uazapi.com/messages/download`, {
                method: 'POST',
                headers: {
                  token: decryptedToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messageid: externalMessageId }),
                signal: downloadCtrl.signal
              }).catch(() => null)
              
              clearTimeout(timeoutId)

              if (downloadRes && downloadRes.ok) {
                const dlData = await downloadRes.json()
                if (dlData.download_url) {
                  const fileCtrl = new AbortController()
                  const fileTimeout = setTimeout(() => fileCtrl.abort(), 10000)
                  
                  const fileRes = await fetch(dlData.download_url, { signal: fileCtrl.signal }).catch(()=>null)
                  clearTimeout(fileTimeout)
                  
                  if (fileRes && fileRes.ok) {
                    const arrayBuffer = await fileRes.arrayBuffer()
                    const uint8Array = new Uint8Array(arrayBuffer)
                    
                    let ext = '.bin'
                    if (mediaMimetype) {
                      if (mediaMimetype.includes('jpeg')) ext = '.jpg'
                      else if (mediaMimetype.includes('png')) ext = '.png'
                      else if (mediaMimetype.includes('webp')) ext = '.webp'
                      else if (mediaMimetype.includes('gif')) ext = '.gif'
                      else if (mediaMimetype.includes('ogg')) ext = '.ogg'
                      else if (mediaMimetype.includes('mpeg')) ext = '.mp3'
                      else if (mediaMimetype.includes('webm')) ext = '.webm'
                      else if (mediaMimetype.includes('mp4')) ext = '.mp4'
                      else if (mediaMimetype.includes('pdf')) ext = '.pdf'
                      else if (mediaMimetype.includes('msword')) ext = '.doc'
                      else if (mediaMimetype.includes('openxmlformats')) ext = '.docx'
                    }
                    
                    const storagePath = `${tenant_id}/${crypto.randomUUID()}${ext}`
                    const { error: uploadError } = await supabaseAdmin.storage
                      .from('whatsapp-media')
                      .upload(storagePath, uint8Array, {
                        contentType: mediaMimetype || 'application/octet-stream',
                        upsert: false
                      })
                      
                    if (!uploadError) {
                      const { data: pubUrlData } = supabaseAdmin.storage.from('whatsapp-media').getPublicUrl(storagePath)
                      if (pubUrlData) permanentMediaUrl = pubUrlData.publicUrl
                    } else {
                      console.error('Media upload error:', uploadError)
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('Media processing error:', e)
        }
      }

      const { data: conv, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('phone_number', senderPhone)
        .maybeSingle()

      if (convError && convError.code !== 'PGRST116') {
        console.error(`Conversation query error: ${convError.message || JSON.stringify(convError)}`)
      }

      let conversationId = ''
      let isBotActive = false

      if (!conv) {
        const { data: existingPatient, error: patientError } = await supabaseAdmin
          .from('patients')
          .select('*')
          .eq('tenant_id', tenant_id)
          .eq('phone', senderPhone)
          .maybeSingle()

        if (patientError && patientError.code !== 'PGRST116') {
          console.error(`Patient query error: ${patientError.message || JSON.stringify(patientError)}`)
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
            .select('id')
            .maybeSingle()

          if (patientInsertError) {
            console.error(`Patient insert error: ${patientInsertError.message || JSON.stringify(patientInsertError)}`)
            patientId = null
          } else if (newPatient) {
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
            phone_number: senderPhone,
            status: 'active',
            last_message_at: new Date().toISOString(),
            unread_count: 1,
            is_bot_active: true
          })
          .select('id, is_bot_active')
          .maybeSingle()

        if (newConvError || !newConv) {
          console.error(`Conversation insert error: ${newConvError?.message || JSON.stringify(newConvError)}`)
          return new Response(JSON.stringify({ success: false, error: 'Falha ao criar conversa.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        conversationId = newConv.id
        isBotActive = newConv.is_bot_active
        console.log(`New conversation created: ${conversationId}`)
      } else {
        conversationId = conv.id
        isBotActive = conv.is_bot_active
        const newUnreadCount = (conv.unread_count || 0) + 1
        const { error: updateError } = await supabaseAdmin
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: newUnreadCount,
          })
          .eq('id', conversationId)

        if (updateError) {
          console.error(`Conversation update error: ${updateError.message || JSON.stringify(updateError)}`)
        }
      }

      const { data: newMessage, error: messageError } = await supabaseAdmin.from('messages')
        .insert({
          tenant_id,
          conversation_id: conversationId,
          content: messageContent,
          direction: 'inbound',
          sender_type: 'patient',
          message_type: messageType,
          uazapi_message_id: externalMessageId,
          media_url: permanentMediaUrl,
          media_type: mediaMimetype,
          media_size: mediaSize,
          media_filename: mediaFilename,
          latitude,
          longitude
        })
        .select('id')
        .maybeSingle()

      if (messageError) {
        console.error(`Message insert error: ${messageError.message || JSON.stringify(messageError)}`)
        return new Response(JSON.stringify({ success: true, message: 'Conversa atualizada mas mensagem nao salva.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`Message saved: ${newMessage?.id}`)

      if (isBotActive) {
        const { data: botConfigs } = await supabaseAdmin
          .from('bot_configs')
          .select('id')
          .eq('tenant_id', tenant_id)
          .eq('status', 'active')
        if (botConfigs && botConfigs.length > 0) {
          fetch(`${supabaseUrlVar}/functions/v1/bot-process-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceRoleKeyVar}`,
            },
            body: JSON.stringify({
              tenant_id,
              conversation_id: conversationId,
              message_content: messageContent,
            }),
          }).catch((err) => console.error(err))
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Mensagem processada', conversation_id: conversationId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else if (eventType === 'messages_update' || eventType === 'messages.update') {
      let updates: any[] = []
      if (Array.isArray(payload.data)) {
        updates = payload.data
      } else if (typeof payload.data === 'object' && payload.data !== null) {
        updates = [payload.data]
      }

      for (const item of updates) {
        const keyId = item.key && item.key.id
        const statusNumber = item.update && item.update.status
        if (keyId && typeof statusNumber === 'number') {
          let deliveryStatus = 'sent'
          if (statusNumber === 2) deliveryStatus = 'delivered'
          else if (statusNumber === 3) deliveryStatus = 'read'
          else if (statusNumber === 4) deliveryStatus = 'played'

          const { error: updateError } = await supabaseAdmin
            .from('messages')
            .update({ delivery_status: deliveryStatus })
            .eq('uazapi_message_id', keyId)

          if (updateError) {
            console.error(`Message status update error: ${updateError.message || JSON.stringify(updateError)}`)
          }
        }
      }
      
      console.log(`Message status update processed`)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      console.log(`Unhandled event type: ${eventType}`)
      console.log(JSON.stringify(payload).substring(0, 200))
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
