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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader)
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token)

    if (!user)
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Envie os dados no formato JSON.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      number,
      type = 'text',
      text,
      media_url,
      filename,
      latitude,
      longitude,
      location_name,
      location_address,
      contact_name,
      contact_phone,
      conversationId,
    } = body

    if (typeof number !== 'string' || !/^\+?[0-9]{10,15}$/.test(number)) {
      return new Response(JSON.stringify({ error: 'Numero invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'text' && (!text || typeof text !== 'string' || text.length < 1)) {
      return new Response(JSON.stringify({ error: 'Numero e texto sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'image' && !media_url) {
      return new Response(JSON.stringify({ error: 'Numero e imagem sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'audio' && !media_url) {
      return new Response(JSON.stringify({ error: 'Numero e audio sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'document' && !media_url) {
      return new Response(JSON.stringify({ error: 'Numero e documento sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'video' && !media_url) {
      return new Response(JSON.stringify({ error: 'Numero e video sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'sticker' && !media_url) {
      return new Response(JSON.stringify({ error: 'Numero e figurinha sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (type === 'location' && (latitude === undefined || longitude === undefined)) {
      return new Response(
        JSON.stringify({ error: 'Numero, latitude e longitude sao obrigatorios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (type === 'contact' && (!contact_name || !contact_phone)) {
      return new Response(
        JSON.stringify({ error: 'Numero, nome e telefone do contato sao obrigatorios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const validTypes = [
      'text',
      'image',
      'audio',
      'document',
      'video',
      'sticker',
      'location',
      'contact',
    ]
    if (!validTypes.includes(type)) {
      return new Response(JSON.stringify({ error: 'Tipo de mensagem invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id)
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
    const { count } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .eq('direction', 'outbound')
      .gte('created_at', oneMinuteAgo)

    if ((count || 0) > 60) {
      return new Response(
        JSON.stringify({ error: 'Limite de mensagens atingido. Aguarde um momento.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: module } = await supabaseAdmin
      .from('tenant_modules')
      .select('is_enabled')
      .eq('tenant_id', profile.tenant_id)
      .eq('module_key', 'whatsapp')
      .single()
    if (!module?.is_enabled)
      return new Response(JSON.stringify({ error: 'Modulo WhatsApp nao disponivel' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const { data: apiKey } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key, metadata')
      .eq('tenant_id', profile.tenant_id)
      .eq('provider', 'uazapi')
      .single()
    if (!apiKey)
      return new Response(JSON.stringify({ error: 'Servico nao configurado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'

    const { data: decryptedToken, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_api_key',
      {
        encrypted_value: apiKey.encrypted_key,
        secret_key: secretKey,
      },
    )

    if (decryptError || !decryptedToken) {
      return new Response(JSON.stringify({ error: 'Erro ao processar solicitacao.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subdomain = Deno.env.get('WHATSAPP_SUBDOMAIN') || (apiKey.metadata as any)?.subdomain
    if (!subdomain)
      return new Response(JSON.stringify({ error: 'Servico nao configurado corretamente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    let finalMediaUrl = media_url
    let permanentMediaUrl = media_url

    if (media_url && typeof media_url === 'string') {
      let storagePath = ''
      if (media_url.startsWith('http') && media_url.includes('supabase.co')) {
        const parts1 = media_url.split('/object/whatsapp-media/')
        const parts2 = media_url.split('/object/sign/whatsapp-media/')
        if (parts1.length > 1) {
          storagePath = parts1[1].split('?')[0]
        } else if (parts2.length > 1) {
          storagePath = parts2[1].split('?')[0]
        }
      } else if (!media_url.startsWith('http')) {
        storagePath = media_url
      }

      if (storagePath) {
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from('whatsapp-media')
          .createSignedUrl(storagePath, 600)
        if (signedError || !signedData) {
          console.error('Signed URL error:', signedError?.message || 'Unknown error')
          return new Response(JSON.stringify({ error: 'Erro ao gerar URL do arquivo.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        finalMediaUrl = signedData.signedUrl

        const { data: pubData } = supabaseAdmin.storage
          .from('whatsapp-media')
          .getPublicUrl(storagePath)
        if (pubData) permanentMediaUrl = pubData.publicUrl
      }
    }

    let uazapiEndpoint = ''
    let uazapiBody: any = {}

    switch (type) {
      case 'text':
        uazapiEndpoint = '/send/text'
        uazapiBody = { number, text }
        break
      case 'image':
        uazapiEndpoint = '/send/image'
        uazapiBody = { number, image: finalMediaUrl, caption: text || '' }
        break
      case 'audio':
        uazapiEndpoint = '/send/audio'
        uazapiBody = { number, audio: finalMediaUrl }
        break
      case 'video':
        uazapiEndpoint = '/send/video'
        uazapiBody = { number, video: finalMediaUrl, caption: text || '' }
        break
      case 'document':
        uazapiEndpoint = '/send/document'
        uazapiBody = { number, document: finalMediaUrl, fileName: filename || 'documento' }
        break
      case 'sticker':
        uazapiEndpoint = '/send/sticker'
        uazapiBody = { number, sticker: finalMediaUrl }
        break
      case 'location':
        uazapiEndpoint = '/send/location'
        uazapiBody = {
          number,
          latitude,
          longitude,
          name: location_name || '',
          address: location_address || '',
        }
        break
      case 'contact':
        uazapiEndpoint = '/send/contact'
        uazapiBody = { number, name: contact_name, phone: contact_phone }
        break
    }

    const baseUrl = `https://${subdomain}.uazapi.com`
    const uazapiRes = await fetch(`${baseUrl}${uazapiEndpoint}`, {
      method: 'POST',
      headers: {
        token: decryptedToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uazapiBody),
    })

    if (!uazapiRes.ok) {
      const errText = await uazapiRes.text().catch(() => '')
      console.error(
        `UAZAPI send error. Status: ${uazapiRes.status} Body: ${errText.substring(0, 500)}`,
      )
      console.error(
        `Request was: type=${type} number=${number.substring(0, 5)}... mediaUrl present=${!!media_url}`,
      )
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao enviar mensagem. Tente novamente.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const uazapiData = await uazapiRes.json().catch(() => ({}))
    console.log(`UAZAPI send success. Type: ${type}`)

    let targetConversationId = conversationId

    if (!targetConversationId) {
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('phone_number', number)
        .maybeSingle()

      if (existingConv) {
        targetConversationId = existingConv.id
      }
    }

    const uazapi_message_id = uazapiData.messageId || uazapiData.id || `app_sent_${Date.now()}`

    if (targetConversationId) {
      let msgContent = ''
      switch (type) {
        case 'text':
          msgContent = text
          break
        case 'image':
          msgContent = text || '[Imagem]'
          break
        case 'audio':
          msgContent = '[Audio]'
          break
        case 'video':
          msgContent = text || '[Video]'
          break
        case 'document':
          msgContent = filename ? `[Documento: ${filename}]` : '[Documento]'
          break
        case 'sticker':
          msgContent = '[Figurinha]'
          break
        case 'location':
          msgContent = '[Localizacao]'
          break
        case 'contact':
          msgContent = contact_name ? `[Contato: ${contact_name}]` : '[Contato]'
          break
        default:
          msgContent = '[Mensagem]'
          break
      }

      const { error: msgInsertError } = await supabaseAdmin.from('messages').insert({
        tenant_id: profile.tenant_id,
        conversation_id: targetConversationId,
        content: msgContent,
        direction: 'outbound',
        sender_type: 'human',
        message_type: type,
        uazapi_message_id,
        media_url: permanentMediaUrl || null,
        media_filename: filename || null,
        delivery_status: 'sent',
      })

      if (msgInsertError) {
        console.error('Error saving message to database:', msgInsertError.message)
      }

      const { error: convUpdateError } = await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', targetConversationId)

      if (convUpdateError) {
        console.error('Error updating conversation last_message_at:', convUpdateError.message)
      }
    }

    return new Response(JSON.stringify({ success: true, id: uazapi_message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('whatsapp-send error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
