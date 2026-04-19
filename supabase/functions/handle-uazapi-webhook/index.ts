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

    console.log('Webhook handler started')
    console.log(`Tenant ID: ${tenant_id}`)

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

    // Rewrite Step 1: Event Type Detection
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

    // Rewrite Step 2: Handle "messages" event
    if (eventType === 'messages') {
      let msg: any = null
      if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
        msg = payload.data
      } else if (payload.data && Array.isArray(payload.data) && payload.data.length > 0) {
        msg = payload.data[0]
      } else if (payload.message && typeof payload.message === 'object') {
        msg = payload.message
      } else {
        msg = payload
      }

      if (!msg) {
        console.log('No message data in payload')
        return new Response(JSON.stringify({ success: true, message: 'Sem dados de mensagem.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
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

      const isFromMe = msg.fromMe === true || (msg.key && msg.key.fromMe === true)

      let remotePhone = ''
      if (msg.chatid) {
        remotePhone = msg.chatid.split('@')[0]
      } else if (msg.key && msg.key.remoteJid) {
        remotePhone = msg.key.remoteJid.split('@')[0]
      }

      if (!remotePhone) {
        if (!isFromMe && msg.sender) {
          remotePhone = msg.sender.split('@')[0]
        } else if (isFromMe) {
          console.log('No chatid available for outbound message, cannot determine remote party')
          return new Response(
            JSON.stringify({ success: true, message: 'Impossivel identificar destinatario.' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }
      }

      if (!remotePhone) {
        console.log('Could not extract remote phone')
        return new Response(
          JSON.stringify({ success: false, message: 'Telefone do remetente nao encontrado.' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      let messageContent = ''
      if (msg.text) {
        messageContent = msg.text
      } else if (
        msg.message &&
        msg.message.conversation &&
        typeof msg.message.conversation === 'string' &&
        msg.message.conversation.length > 0
      ) {
        messageContent = msg.message.conversation
      } else if (
        msg.message &&
        msg.message.extendedTextMessage &&
        msg.message.extendedTextMessage.text
      ) {
        messageContent = msg.message.extendedTextMessage.text
      } else if (msg.body) {
        messageContent = msg.body
      } else {
        let typeCheck = ''
        if (msg.messageType) {
          typeCheck = msg.messageType.toLowerCase()
        }
        if (typeCheck.includes('image')) messageContent = '[Imagem]'
        else if (typeCheck.includes('video')) messageContent = '[Video]'
        else if (typeCheck.includes('audio') || typeCheck.includes('ptt'))
          messageContent = '[Audio]'
        else if (typeCheck.includes('document')) messageContent = '[Documento]'
        else if (typeCheck.includes('sticker')) messageContent = '[Figurinha]'
        else if (typeCheck.includes('location')) messageContent = '[Localizacao]'
        else if (typeCheck.includes('contact')) messageContent = '[Contato]'
        else if (typeCheck.includes('reaction'))
          messageContent = msg.reaction ? msg.reaction : '[Reacao]'
        else if (typeCheck.includes('poll')) messageContent = '[Enquete]'
        else messageContent = '[Mensagem]'
      }

      let direction = 'inbound'
      let senderType = 'patient'
      let senderName = ''

      if (isFromMe) {
        direction = 'outbound'
        senderType = 'human'
        senderName = payload.instanceName || payload.owner || 'Voce'
      } else {
        direction = 'inbound'
        senderType = 'patient'
        if (msg.senderName) senderName = msg.senderName
        else if (msg.pushName) senderName = msg.pushName
        else if (msg.notify) senderName = msg.notify
        else senderName = remotePhone
      }

      console.log(
        `Processing message. Direction: ${direction}, fromMe: ${isFromMe}, Remote phone: ${remotePhone}`,
      )

      let externalMessageId = null
      if (msg.messageid) externalMessageId = msg.messageid
      else if (msg.key && msg.key.id) externalMessageId = msg.key.id
      else if (typeof msg.id === 'string') externalMessageId = msg.id
      else if (msg.messageId) externalMessageId = msg.messageId

      if (externalMessageId) {
        const { data: existingMsg } = await supabaseAdmin
          .from('messages')
          .select('id, delivery_status')
          .eq('uazapi_message_id', externalMessageId)
          .maybeSingle()

        if (existingMsg) {
          console.log(`Message already exists, skipping duplicate: ${externalMessageId}`)

          let statusNumber = msg.status || (msg.update && msg.update.status)
          if (typeof statusNumber === 'number') {
            let deliveryStatus = existingMsg.delivery_status || 'sent'
            if (statusNumber === 2) deliveryStatus = 'delivered'
            else if (statusNumber === 3) deliveryStatus = 'read'
            else if (statusNumber === 4) deliveryStatus = 'played'

            await supabaseAdmin
              .from('messages')
              .update({ delivery_status: deliveryStatus })
              .eq('id', existingMsg.id)
          } else if (typeof statusNumber === 'string') {
            await supabaseAdmin
              .from('messages')
              .update({ delivery_status: statusNumber.toLowerCase() })
              .eq('id', existingMsg.id)
          }

          return new Response(
            JSON.stringify({ success: true, message: 'Mensagem ja registrada.' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }
      }

      let mappedType = 'other'
      if (msg.messageType) {
        const t = msg.messageType
        if (t === 'conversation' || t === 'extendedTextMessage') mappedType = 'text'
        else if (t === 'imageMessage') mappedType = 'image'
        else if (t === 'videoMessage') mappedType = 'video'
        else if (t === 'audioMessage' || t === 'pttMessage') mappedType = 'audio'
        else if (t === 'documentMessage' || t === 'documentWithCaptionMessage')
          mappedType = 'document'
        else if (t === 'stickerMessage') mappedType = 'sticker'
        else if (t === 'locationMessage' || t === 'liveLocationMessage') mappedType = 'location'
        else if (t === 'contactMessage' || t === 'contactsArrayMessage') mappedType = 'contact'
        else if (t === 'reactionMessage') mappedType = 'reaction'
        else if (t === 'pollCreationMessage' || t === 'pollUpdateMessage') mappedType = 'poll'
      }

      console.log(
        `Processing message from: ${remotePhone} name: ${senderName} type: ${mappedType} content preview: ${messageContent.substring(0, 50)}`,
      )

      let latitude = null
      let longitude = null

      if (mappedType === 'location') {
        latitude = msg.latitude || msg.degreesLatitude || null
        longitude = msg.longitude || msg.degreesLongitude || null
      }

      const isMediaMessage = ['image', 'audio', 'video', 'document', 'sticker'].includes(mappedType)

      let mediaUrl = msg.fileURL || msg.fileUrl || msg.file_url || msg.mediaUrl || msg.media_url
      let mediaMimetype = msg.mimetype || msg.mediaMimetype || msg.media_mimetype

      if (!mediaMimetype) {
        if (mappedType === 'image') mediaMimetype = 'image/jpeg'
        else if (mappedType === 'audio') mediaMimetype = 'audio/ogg'
        else if (mappedType === 'video') mediaMimetype = 'video/mp4'
        else if (mappedType === 'document') mediaMimetype = 'application/octet-stream'
        else if (mappedType === 'sticker') mediaMimetype = 'image/webp'
      }

      let mediaSize = msg.mediaSize || msg.media_size
      let mediaFilename =
        msg.fileName || msg.filename || msg.mediaFilename || msg.media_filename || msg.title

      let permanentMediaUrl = mediaUrl
      let directDownloadAttempted = false
      let messagesDownloadAttempted = false
      let uploadResult = 'skipped'

      console.log(`Media processing: isMediaMessage=${isMediaMessage}`)
      console.log(`Media processing: fileURL from msg=${!!msg.fileURL}`)

      if (isMediaMessage) {
        let uint8Array: Uint8Array | null = null

        if (mediaUrl && mediaUrl.startsWith('http')) {
          directDownloadAttempted = true
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)
            const res = await fetch(mediaUrl, { signal: controller.signal })
            clearTimeout(timeoutId)
            if (res.ok) {
              const ct = res.headers.get('content-type')
              if (ct && !ct.includes('application/json')) {
                mediaMimetype = ct
              }
              uint8Array = new Uint8Array(await res.arrayBuffer())
            }
          } catch (e) {
            console.log('Direct download failed:', e)
          }
        }

        console.log(`Media processing: direct download attempted=${directDownloadAttempted}`)

        if (!uint8Array && externalMessageId) {
          messagesDownloadAttempted = true
          try {
            const { data: apiKeyRow } = await supabaseAdmin
              .from('tenant_api_keys')
              .select('encrypted_key, metadata')
              .eq('tenant_id', tenant_id)
              .eq('provider', 'uazapi')
              .maybeSingle()
            if (apiKeyRow) {
              const secret = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
              const { data: webhookInstanceToken } = await supabaseAdmin.rpc('decrypt_api_key', {
                encrypted_value: apiKeyRow.encrypted_key,
                secret_key: secret,
              })
              const subdomain =
                Deno.env.get('WHATSAPP_SUBDOMAIN') || (apiKeyRow.metadata as any)?.subdomain

              if (webhookInstanceToken && subdomain) {
                const downloadUrl = `https://${subdomain}.uazapi.com/messages/download`
                const res = await fetch(downloadUrl, {
                  method: 'POST',
                  headers: { token: webhookInstanceToken, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messageid: externalMessageId }),
                })

                if (res.ok) {
                  const ct = res.headers.get('content-type') || ''
                  if (ct.includes('application/json')) {
                    const data = await res.json()
                    const urlToFetch = data.url || data.download_url || data.fileURL || data.base64
                    if (data.url || data.download_url || data.fileURL) {
                      const urlToFetchVal = data.url || data.download_url || data.fileURL
                      const urlRes = await fetch(urlToFetchVal)
                      if (urlRes.ok) uint8Array = new Uint8Array(await urlRes.arrayBuffer())
                    } else if (data.base64) {
                      const binStr = atob(data.base64)
                      uint8Array = new Uint8Array(binStr.length)
                      for (let i = 0; i < binStr.length; i++) uint8Array[i] = binStr.charCodeAt(i)
                    }
                  } else {
                    uint8Array = new Uint8Array(await res.arrayBuffer())
                  }
                }
              }
            }
          } catch (e) {
            console.log('/messages/download failed:', e)
          }
        }

        console.log(`Media processing: /messages/download attempted=${messagesDownloadAttempted}`)

        if (uint8Array) {
          let ext = '.bin'
          if (mediaMimetype) {
            if (mediaMimetype.includes('jpeg')) ext = '.jpg'
            else if (mediaMimetype.includes('png')) ext = '.png'
            else if (mediaMimetype.includes('webp')) ext = '.webp'
            else if (mediaMimetype.includes('gif')) ext = '.gif'
            else if (mediaMimetype.includes('ogg')) ext = '.ogg'
            else if (mediaMimetype.includes('mpeg') || mediaMimetype.includes('mp3')) ext = '.mp3'
            else if (mediaMimetype.includes('webm')) ext = '.webm'
            else if (mediaMimetype.includes('mp4')) ext = '.mp4'
            else if (mediaMimetype.includes('pdf')) ext = '.pdf'
            else if (mediaMimetype.includes('msword')) ext = '.doc'
            else if (mediaMimetype.includes('openxmlformats')) ext = '.docx'
          } else {
            if (mappedType === 'image') ext = '.jpg'
            else if (mappedType === 'audio') ext = '.ogg'
            else if (mappedType === 'video') ext = '.mp4'
            else if (mappedType === 'document') ext = '.pdf'
            else if (mappedType === 'sticker') ext = '.webp'
          }

          const storagePath = `${tenant_id}/${crypto.randomUUID()}${ext}`
          const { error: uploadError } = await supabaseAdmin.storage
            .from('whatsapp-media')
            .upload(storagePath, uint8Array, {
              contentType: mediaMimetype || 'application/octet-stream',
              upsert: false,
            })

          if (!uploadError) {
            let supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
            if (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1)
            const encodedPath = storagePath
              .split('/')
              .map((seg) => encodeURIComponent(seg))
              .join('/')
            permanentMediaUrl = `${supabaseUrl}/storage/v1/object/public/whatsapp-media/${encodedPath}`
            uploadResult = 'success'
          } else {
            uploadResult = uploadError.message
            permanentMediaUrl = mediaUrl?.startsWith('http') ? mediaUrl : null
          }
        } else {
          console.log(`Media download failed for message: ${externalMessageId}`)
          permanentMediaUrl = null
          uploadResult = 'download_failed'
        }

        console.log(`Media processing: upload result=${uploadResult}`)
        console.log(`Media processing: final permanentMediaUrl present=${!!permanentMediaUrl}`)
      }

      // Query existing patient
      const { data: existingPatient, error: patientQueryError } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('phone', remotePhone)
        .maybeSingle()

      if (patientQueryError && patientQueryError.code !== 'PGRST116') {
        console.error(
          `Patient query error: ${patientQueryError.message || JSON.stringify(patientQueryError)}`,
        )
      }

      // Query existing conversation
      const { data: existingConv, error: convQueryError } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('phone_number', remotePhone)
        .maybeSingle()

      if (convQueryError && convQueryError.code !== 'PGRST116') {
        console.error(
          `Conversation query error: ${convQueryError.message || JSON.stringify(convQueryError)}`,
        )
      }

      const hasLetters = (str: string) => /[a-zA-Z]/.test(str)
      const isInstanceName = (str: string) => str === payload.instanceName || str === payload.owner

      let patientName = ''

      // Priority 1: Existing patient in database
      if (existingPatient && existingPatient.full_name && hasLetters(existingPatient.full_name)) {
        patientName = existingPatient.full_name
      }
      // Priority 2: WhatsApp display name from inbound message
      else if (!isFromMe && senderName && !isInstanceName(senderName) && hasLetters(senderName)) {
        patientName = senderName
      }
      // Priority 3: Existing conversation name (via patient_id if present)
      else if (existingConv && existingPatient && existingPatient.full_name) {
        patientName = existingPatient.full_name
      }
      // Priority 4: Phone number fallback
      else {
        patientName = remotePhone
      }

      let conversationId = ''
      let isBotActive = false
      let finalPatientId = existingPatient?.id || null

      if (!existingPatient) {
        const { data: newPatient, error: patientInsertError } = await supabaseAdmin
          .from('patients')
          .insert({
            tenant_id,
            full_name: patientName,
            phone: remotePhone,
            source: 'whatsapp',
            pipeline_stage: 'lead',
          })
          .select('id')
          .maybeSingle()

        if (patientInsertError) {
          if (patientInsertError.code === '23505') {
            const { data: checkDup } = await supabaseAdmin
              .from('patients')
              .select('id')
              .eq('tenant_id', tenant_id)
              .eq('phone', remotePhone)
              .maybeSingle()
            if (checkDup) finalPatientId = checkDup.id
          } else {
            console.error(
              `Patient insert error: ${patientInsertError.message || JSON.stringify(patientInsertError)}`,
            )
          }
        } else if (newPatient) {
          finalPatientId = newPatient.id
          try {
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-automations`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${serviceRoleKeyVar}`,
                apikey: serviceRoleKeyVar,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                event_type: 'stage_change',
                tenant_id,
                patient_id: finalPatientId,
                context: { old_stage: 'none', new_stage: 'lead' },
              }),
            }).catch((e) => console.error('Error triggering automation:', e))
            console.log(
              `Automation trigger: stage_change from=none to=lead patient=${finalPatientId}`,
            )
          } catch (e) {}
        }
      }

      // Fix 6: One-time data fix and auto-correction
      if (
        !isFromMe &&
        finalPatientId &&
        senderName &&
        hasLetters(senderName) &&
        !isInstanceName(senderName)
      ) {
        const currentFullName = existingPatient?.full_name || patientName
        const isCurrentNameBad =
          currentFullName === 'Cliente1' ||
          isInstanceName(currentFullName) ||
          !hasLetters(currentFullName)

        if (isCurrentNameBad && senderName !== currentFullName) {
          await supabaseAdmin
            .from('patients')
            .update({ full_name: senderName })
            .eq('id', finalPatientId)
          patientName = senderName
        }
      }

      if (!existingConv) {
        const { data: newConv, error: newConvError } = await supabaseAdmin
          .from('conversations')
          .insert({
            tenant_id,
            patient_id: finalPatientId,
            phone_number: remotePhone,
            status: 'active',
            last_message_at: new Date().toISOString(),
            unread_count: direction === 'inbound' ? 1 : 0,
            is_bot_active: true,
          })
          .select('id, is_bot_active')
          .maybeSingle()

        if (newConvError || !newConv) {
          console.error(
            `Conversation insert error: ${newConvError?.message || JSON.stringify(newConvError)}`,
          )
          return new Response(
            JSON.stringify({ success: false, error: 'Falha ao criar conversa.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        conversationId = newConv.id
        isBotActive = newConv.is_bot_active
        console.log(`New conversation created: ${conversationId}`)
      } else {
        conversationId = existingConv.id
        isBotActive = existingConv.is_bot_active

        if (!existingConv.patient_id && finalPatientId) {
          await supabaseAdmin
            .from('conversations')
            .update({ patient_id: finalPatientId })
            .eq('id', conversationId)
        }

        const newUnreadCount =
          direction === 'inbound'
            ? (existingConv.unread_count || 0) + 1
            : existingConv.unread_count || 0
        const { error: convUpdateError } = await supabaseAdmin
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: newUnreadCount,
          })
          .eq('id', conversationId)

        if (convUpdateError) {
          console.error(
            `Conversation update error: ${convUpdateError.message || JSON.stringify(convUpdateError)}`,
          )
        }
      }

      if (isFromMe) {
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
        const { data: recentDup } = await supabaseAdmin
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('content', messageContent)
          .eq('direction', 'outbound')
          .gte('created_at', thirtySecondsAgo)
          .limit(1)

        if (recentDup && recentDup.length > 0) {
          console.log(`Duplicate outbound message skipped.`)
          return new Response(
            JSON.stringify({ success: true, message: 'Mensagem ja registrada.' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }

        let wasSentByApi = msg.wasSentByApi === true || payload.wasSentByApi === true
        if (!wasSentByApi) {
          isBotActive = false
          const { error: pauseUpdateError } = await supabaseAdmin
            .from('conversations')
            .update({
              is_bot_active: false,
              bot_paused_at: new Date().toISOString(),
              bot_paused_reason: 'human_message',
            })
            .eq('id', conversationId)

          if (pauseUpdateError) {
            await supabaseAdmin
              .from('conversations')
              .update({ is_bot_active: false })
              .eq('id', conversationId)
          }
          console.log(`Auto-pause bot: human sent manual message in conversation ${conversationId}`)
        }
      }

      const { data: newMessage, error: messageError } = await supabaseAdmin
        .from('messages')
        .insert({
          tenant_id,
          conversation_id: conversationId,
          content: messageContent,
          direction,
          sender_type: senderType,
          message_type: mappedType,
          uazapi_message_id: externalMessageId,
          media_url: permanentMediaUrl,
          media_type: mediaMimetype,
          media_size: mediaSize,
          media_filename: mediaFilename,
          latitude,
          longitude,
        })
        .select('id')
        .maybeSingle()

      if (messageError) {
        console.error(
          `Message insert error: ${messageError.message || JSON.stringify(messageError)}`,
        )
        return new Response(
          JSON.stringify({ success: true, message: 'Conversa atualizada mas mensagem nao salva.' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      console.log(`Message saved: ${newMessage?.id}`)

      if (isBotActive && direction === 'inbound') {
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
      } else if (!isBotActive && direction === 'inbound') {
        console.log('Bot invocation skipped: is_bot_active=false.')
      }

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
      } else if (payload.state) {
        connectionState = payload.state
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

        const { error: updateError } = await supabaseAdmin
          .from('tenant_api_keys')
          .update({
            metadata: {
              ...existingMetadata,
              connected: true,
              instance_status: 'connected',
              connected_at: new Date().toISOString(),
              instance_name: payload.instanceName || payload.owner || '',
              owner_number: payload.owner || '',
            },
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')

        if (updateError) {
          console.error(
            `Connection update error: ${updateError.message || JSON.stringify(updateError)}`,
          )
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
              disconnected_at: new Date().toISOString(),
            },
          })
          .eq('tenant_id', tenant_id)
          .eq('provider', 'uazapi')

        if (updateError) {
          console.error(
            `Connection update error: ${updateError.message || JSON.stringify(updateError)}`,
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Evento de conexao processado.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } else if (eventType === 'messages_update' || eventType === 'messages.update') {
      let updates: any[] = []
      if (Array.isArray(payload.data)) {
        updates = payload.data
      } else if (typeof payload.data === 'object' && payload.data !== null) {
        updates = [payload.data]
      }

      for (const item of updates) {
        const keyId = (item.key && item.key.id) || item.messageid
        const statusVal = (item.update && item.update.status) || item.status

        if (keyId && statusVal !== undefined) {
          let deliveryStatus = 'unknown'

          if (typeof statusVal === 'number') {
            if (statusVal === 0) deliveryStatus = 'error'
            else if (statusVal === 1) deliveryStatus = 'pending'
            else if (statusVal === 2) deliveryStatus = 'sent'
            else if (statusVal === 3) deliveryStatus = 'delivered'
            else if (statusVal === 4) deliveryStatus = 'read'
            else if (statusVal === 5) deliveryStatus = 'played'
          } else if (typeof statusVal === 'string') {
            deliveryStatus = statusVal.toLowerCase()
          }

          if (deliveryStatus !== 'unknown') {
            const { error: updateError } = await supabaseAdmin
              .from('messages')
              .update({ delivery_status: deliveryStatus })
              .eq('uazapi_message_id', keyId)

            if (updateError) {
              console.error(
                `Message status update error: ${updateError.message || JSON.stringify(updateError)}`,
              )
            }
          }
        }
      }

      console.log(`Message status update processed for ${updates.length} items`)
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
