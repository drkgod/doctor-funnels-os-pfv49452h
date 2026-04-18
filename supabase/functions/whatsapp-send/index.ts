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

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Envie os dados no formato JSON.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const number = body.number || ''
    const type = body.type || 'text'
    const text = body.text || ''
    let mediaUrl = body.media_url || body.mediaUrl || ''
    const filename = body.filename || body.fileName || ''
    const conversationId = body.conversation_id || body.conversationId || ''
    const latitude = body.latitude
    const longitude = body.longitude
    const locationName = body.location_name || body.locationName || ''
    const locationAddress = body.location_address || body.locationAddress || ''
    const contactName = body.contact_name || body.contactName || ''
    const contactPhone = body.contact_phone || body.contactPhone || ''
    const tenantIdFromBody = body.tenant_id || body.tenantId || ''

    console.log(
      `Send request: type=${type}, number=${number?.substring(0, 6)}..., mediaUrl present=${!!mediaUrl}, conversationId=${conversationId}`,
    )

    const originalMediaPath = mediaUrl

    if (mediaUrl && !mediaUrl.startsWith('http')) {
      console.log(`Public URL generation: path=${mediaUrl}`)
      const { data: publicData } = supabaseAdmin.storage
        .from('whatsapp-media')
        .getPublicUrl(mediaUrl)

      if (publicData?.publicUrl) {
        mediaUrl = publicData.publicUrl
        console.log('Public URL generated successfully')
        console.log(`Public URL for UAZAPI (first 80 chars): ${mediaUrl.substring(0, 80)}`)
      }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    const tenant_id = profile?.tenant_id || tenantIdFromBody
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: apiKey } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key, metadata')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'uazapi')
      .single()

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Instancia WhatsApp nao configurada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
    const { data: instanceToken, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_api_key',
      {
        encrypted_value: apiKey.encrypted_key,
        secret_key: secretKey,
      },
    )

    if (decryptError || !instanceToken) {
      return new Response(JSON.stringify({ error: 'Instancia WhatsApp nao configurada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subdomain = Deno.env.get('WHATSAPP_SUBDOMAIN') || (apiKey.metadata as any)?.subdomain
    if (!subdomain) {
      console.error('Subdomain not found')
      return new Response(JSON.stringify({ error: 'Servico nao configurado corretamente.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = `https://${subdomain}.uazapi.com`

    let endpoint = ''
    let reqBody: any = {}

    if (type === 'text') {
      if (!number || !text)
        return new Response(JSON.stringify({ error: 'Numero e texto sao obrigatorios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      endpoint = '/send/text'
      reqBody = { number, text }
    } else if (type === 'image') {
      if (!number || !mediaUrl)
        return new Response(JSON.stringify({ error: 'Numero e imagem sao obrigatorios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      endpoint = '/send/image'
      reqBody = { number, image: mediaUrl }
      if (text) reqBody.caption = text
    } else if (type === 'audio') {
      if (!number || !mediaUrl)
        return new Response(JSON.stringify({ error: 'Numero e audio sao obrigatorios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      endpoint = '/send/audio'
      reqBody = { number, audio: mediaUrl }
    } else if (type === 'video') {
      if (!number || !mediaUrl)
        return new Response(JSON.stringify({ error: 'Numero e video sao obrigatorios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      endpoint = '/send/video'
      reqBody = { number, video: mediaUrl }
      if (text) reqBody.caption = text
    } else if (type === 'document') {
      if (!number || !mediaUrl)
        return new Response(JSON.stringify({ error: 'Numero e documento sao obrigatorios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      endpoint = '/send/document'
      reqBody = { number, document: mediaUrl, fileName: filename || 'documento.pdf' }
    } else if (type === 'sticker') {
      if (!number || !mediaUrl)
        return new Response(JSON.stringify({ error: 'Numero e figurinha sao obrigatorios.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      endpoint = '/send/sticker'
      reqBody = { number, sticker: mediaUrl }
    } else if (type === 'location') {
      if (!number || latitude === undefined || longitude === undefined)
        return new Response(
          JSON.stringify({ error: 'Numero, latitude e longitude sao obrigatorios.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      endpoint = '/send/location'
      reqBody = { number, latitude, longitude, name: locationName, address: locationAddress }
    } else if (type === 'contact') {
      if (!number || !contactName || !contactPhone)
        return new Response(
          JSON.stringify({ error: 'Numero, nome e telefone do contato sao obrigatorios.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      endpoint = '/send/contact'
      reqBody = { number, name: contactName, phone: contactPhone }
    } else {
      return new Response(JSON.stringify({ error: `Tipo de mensagem nao suportado: ${type}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Calling UAZAPI: endpoint=${endpoint}, baseUrl=${baseUrl}`)

    const safeReqBody = { ...reqBody }
    if (safeReqBody.image) safeReqBody.image = safeReqBody.image.substring(0, 80) + '...'
    if (safeReqBody.audio) safeReqBody.audio = safeReqBody.audio.substring(0, 80) + '...'
    if (safeReqBody.video) safeReqBody.video = safeReqBody.video.substring(0, 80) + '...'
    if (safeReqBody.document) safeReqBody.document = safeReqBody.document.substring(0, 80) + '...'
    if (safeReqBody.sticker) safeReqBody.sticker = safeReqBody.sticker.substring(0, 80) + '...'
    console.log(`Request body was: ${JSON.stringify(safeReqBody)}`)
    console.log(`URL that was sent (first 100 chars): ${mediaUrl.substring(0, 100)}`)

    const uazapiRes = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        token: instanceToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reqBody),
    })

    if (!uazapiRes.ok) {
      const errText = await uazapiRes.text().catch(() => '')
      console.log(`UAZAPI error: status=${uazapiRes.status}, body=${errText.substring(0, 500)}`)

      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao enviar mensagem. Tente novamente.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const uazapiResponse = await uazapiRes.json().catch(() => ({}))
    console.log(`UAZAPI success: type=${type}`)

    let dbContent = ''
    if (type === 'text') dbContent = text
    else if (type === 'image') dbContent = text || '[Imagem]'
    else if (type === 'audio') dbContent = '[Audio]'
    else if (type === 'video') dbContent = text || '[Video]'
    else if (type === 'document') dbContent = filename ? `[Documento: ${filename}]` : '[Documento]'
    else if (type === 'sticker') dbContent = '[Figurinha]'
    else if (type === 'location') dbContent = '[Localizacao]'
    else if (type === 'contact') dbContent = `[Contato: ${contactName}]`

    let mappedType = 'other'
    if (
      ['text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact'].includes(
        type,
      )
    ) {
      mappedType = type
    }

    let targetConvId = conversationId
    if (!targetConvId) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('phone_number', number)
        .maybeSingle()
      if (conv) targetConvId = conv.id
    }

    if (targetConvId) {
      const mediaDbUrl = ['image', 'audio', 'video', 'document', 'sticker'].includes(type)
        ? originalMediaPath
        : null

      const { error: insertError } = await supabaseAdmin.from('messages').insert({
        tenant_id,
        conversation_id: targetConvId,
        content: dbContent,
        direction: 'outbound',
        sender_type: 'human',
        message_type: mappedType,
        media_url: mediaDbUrl,
        media_filename: filename || null,
        latitude: type === 'location' ? latitude : null,
        longitude: type === 'location' ? longitude : null,
        delivery_status: 'sent',
      })

      if (insertError) {
        console.log(`Message save error: ${insertError.message}`)
      }

      const { error: updateError } = await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', targetConvId)

      if (updateError) {
        console.log(`Conversation update error: ${updateError.message}`)
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: uazapiResponse.messageId || uazapiResponse.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('whatsapp-send error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
