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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

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
    let tenant_id = tenantIdFromBody

    if (!tenant_id && authHeader) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      )
      const {
        data: { user: authUser },
      } = await supabaseUser.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('tenant_id')
          .eq('id', authUser.id)
          .single()
        if (profile?.tenant_id) tenant_id = profile.tenant_id
      }
    }

    console.log(`Resolved tenant_id: ${tenant_id?.substring(0, 8)}`)

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id nao fornecido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(
      `Send request: type=${type}, number=${number?.substring(0, 6)}..., mediaUrl present=${!!mediaUrl}, conversationId=${conversationId}`,
    )

    const originalMediaPath = mediaUrl

    let publicMediaUrl = mediaUrl
    if (mediaUrl && !mediaUrl.startsWith('http')) {
      let supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      if (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1)

      const pathSegments = mediaUrl.split('/')
      const folderPath = pathSegments.slice(0, -1).join('/')
      const fileName = pathSegments[pathSegments.length - 1]

      const { data: listData } = await supabaseAdmin.storage.from('whatsapp-media').list(folderPath)
      const fileExists = listData?.some((f: any) => f.name === fileName)
      if (!fileExists) {
        console.log(`File not found in storage: ${mediaUrl}`)
      }

      const encodedPath = pathSegments.map((seg: string) => encodeURIComponent(seg)).join('/')
      publicMediaUrl = `${supabaseUrl}/storage/v1/object/public/whatsapp-media/${encodedPath}`

      console.log(`Constructed public URL: ${publicMediaUrl.substring(0, 150)}`)
    }

    const { data: apiKey } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key, metadata')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'uazapi')
      .maybeSingle()

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Instancia WhatsApp nao configurada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'

    const { data: instanceTokenData, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_api_key',
      {
        encrypted_value: apiKey.encrypted_key,
        secret_key: secretKey,
      },
    )

    console.log(
      `Decrypt RPC result: data present=${!!instanceTokenData}, error=${decryptError ? decryptError.message : 'null'}`,
    )

    if (decryptError) {
      console.log(`Token decrypt RPC error: ${decryptError.message}`)
      return new Response(
        JSON.stringify({ error: 'Erro de configuracao da instancia WhatsApp.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!instanceTokenData || instanceTokenData.trim() === '') {
      console.log(
        'Token decrypt returned empty. Check ENCRYPTION_KEY secret and encrypted_key value.',
      )
      return new Response(JSON.stringify({ error: 'Token da instancia nao encontrado.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const instanceToken = instanceTokenData
    console.log(`Instance token present: ${!!instanceToken}, length: ${instanceToken.length}`)

    let uazapiEndpoint = ''
    const uazapiBody: any = {}

    if (type === 'text') {
      uazapiEndpoint = '/send/text'
      uazapiBody.number = number
      uazapiBody.text = text
    } else if (type === 'image') {
      uazapiEndpoint = '/send/image'
      uazapiBody.number = number
      uazapiBody.image = publicMediaUrl
      if (text) uazapiBody.caption = text
    } else if (type === 'audio') {
      uazapiEndpoint = '/send/audio'
      uazapiBody.number = number
      uazapiBody.audio = publicMediaUrl
    } else if (type === 'video') {
      uazapiEndpoint = '/send/video'
      uazapiBody.number = number
      uazapiBody.video = publicMediaUrl
      if (text) uazapiBody.caption = text
    } else if (type === 'document') {
      uazapiEndpoint = '/send/document'
      uazapiBody.number = number
      uazapiBody.document = publicMediaUrl
      uazapiBody.fileName = filename || 'documento'
    } else if (type === 'sticker') {
      uazapiEndpoint = '/send/sticker'
      uazapiBody.number = number
      uazapiBody.sticker = publicMediaUrl
    } else if (type === 'location') {
      uazapiEndpoint = '/send/location'
      uazapiBody.number = number
      uazapiBody.latitude = latitude
      uazapiBody.longitude = longitude
      uazapiBody.name = locationName || ''
      uazapiBody.address = locationAddress || ''
    } else if (type === 'contact') {
      uazapiEndpoint = '/send/contact'
      uazapiBody.number = number
      uazapiBody.name = contactName
      uazapiBody.phone = contactPhone
    } else {
      return new Response(JSON.stringify({ error: 'Tipo de mensagem nao suportado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subdomain = Deno.env.get('WHATSAPP_SUBDOMAIN')
    if (!subdomain) subdomain = (apiKey.metadata as any)?.subdomain

    if (!subdomain) {
      console.error('Subdomain not found')
      return new Response(JSON.stringify({ error: 'Servico nao configurado corretamente.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fullUazapiUrl = `https://${subdomain}.uazapi.com${uazapiEndpoint}`
    console.log(
      `UAZAPI call: URL=${fullUazapiUrl}, body keys=${Object.keys(uazapiBody).join(',')}, media URL (first 80 chars)=${publicMediaUrl ? publicMediaUrl.substring(0, 80) : 'none'}`,
    )

    const uazapiRes = await fetch(fullUazapiUrl, {
      method: 'POST',
      headers: {
        token: instanceToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uazapiBody),
    })

    if (!uazapiRes.ok) {
      const errText = await uazapiRes.text().catch(() => '')
      console.log(
        `UAZAPI error response. Status: ${uazapiRes.status}, StatusText: ${uazapiRes.statusText}, Body: ${errText.substring(0, 500)}`,
      )
      console.log(
        `Token used (first 8 chars): ${instanceToken.substring(0, 8)}, Full UAZAPI URL: ${fullUazapiUrl}`,
      )
      return new Response(JSON.stringify({ error: 'Erro ao enviar mensagem. Tente novamente.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await uazapiRes.json().catch(() => ({}))
    console.log(`UAZAPI success. Type: ${type}`)

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
      const insertData: any = {
        tenant_id,
        conversation_id: targetConvId,
        content: dbContent,
        direction: 'outbound',
        sender_type: 'human',
        message_type: mappedType,
        delivery_status: 'sent',
      }

      if (['image', 'audio', 'video', 'document', 'sticker'].includes(type)) {
        insertData.media_url = originalMediaPath
        if (filename) insertData.media_filename = filename
      }

      if (type === 'location') {
        insertData.latitude = latitude
        insertData.longitude = longitude
      }

      const { error: insertError } = await supabaseAdmin.from('messages').insert(insertData)

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

    return new Response(JSON.stringify({ success: true, message: 'Mensagem enviada.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('whatsapp-send error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
