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
      number, type = 'text', text, media_url, filename, 
      latitude, longitude, location_name, location_address, 
      contact_name, contact_phone, conversationId 
    } = body

    if (typeof number !== 'string' || !/^\+?[0-9]{10,15}$/.test(number)) {
      return new Response(JSON.stringify({ error: 'Numero invalido.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (type === 'text' && (!text || typeof text !== 'string' || text.length < 1)) {
      return new Response(JSON.stringify({ error: 'Texto invalido.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (['image', 'audio', 'document', 'sticker'].includes(type) && (!media_url || typeof media_url !== 'string')) {
      return new Response(JSON.stringify({ error: 'URL de midia invalida.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (type === 'location' && (latitude === undefined || longitude === undefined)) {
      return new Response(JSON.stringify({ error: 'Coordenadas invalidas.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (type === 'contact' && (!contact_name || !contact_phone)) {
      return new Response(JSON.stringify({ error: 'Dados de contato invalidos.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

    const subdomain = (apiKey.metadata as any)?.subdomain
    if (!subdomain)
      return new Response(JSON.stringify({ error: 'Servico nao configurado corretamente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    let finalMediaUrl = media_url
    if (media_url && typeof media_url === 'string') {
      if (media_url.includes('/storage/v1/object/sign/whatsapp-media/') || media_url.includes('/storage/v1/object/public/whatsapp-media/')) {
        const parts = media_url.split('/whatsapp-media/')
        if (parts.length > 1) {
          const storagePath = parts[1].split('?')[0]
          const { data: signedData, error: signedError } = await supabaseAdmin.storage.from('whatsapp-media').createSignedUrl(storagePath, 300)
          if (!signedError && signedData) {
            finalMediaUrl = signedData.signedUrl
          }
        }
      } else if (!media_url.startsWith('http')) {
        const { data: signedData } = await supabaseAdmin.storage.from('whatsapp-media').createSignedUrl(media_url, 300)
        if (signedData) finalMediaUrl = signedData.signedUrl
      }
    }

    let uazapiEndpoint = ''
    let uazapiBody: any = {}

    if (type === 'text') {
      uazapiEndpoint = '/send/text'
      uazapiBody = { number, text, readchat: true }
    } else if (type === 'image') {
      uazapiEndpoint = '/send/image'
      uazapiBody = { number, image: finalMediaUrl, caption: text || '', readchat: true }
    } else if (type === 'audio') {
      uazapiEndpoint = '/send/audio'
      uazapiBody = { number, audio: finalMediaUrl, readchat: true }
    } else if (type === 'document') {
      uazapiEndpoint = '/send/document'
      uazapiBody = { number, document: finalMediaUrl, fileName: filename || 'documento', readchat: true }
    } else if (type === 'sticker') {
      uazapiEndpoint = '/send/sticker'
      uazapiBody = { number, sticker: finalMediaUrl, readchat: true }
    } else if (type === 'location') {
      uazapiEndpoint = '/send/location'
      uazapiBody = { number, latitude, longitude, name: location_name || '', address: location_address || '', readchat: true }
    } else if (type === 'contact') {
      uazapiEndpoint = '/send/contact'
      uazapiBody = { number, name: contact_name, phone: contact_phone, readchat: true }
    }

    const uazapiRes = await fetch(`https://${subdomain}.uazapi.com${uazapiEndpoint}`, {
      method: 'POST',
      headers: {
        token: decryptedToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uazapiBody),
    })

    if (!uazapiRes.ok) {
      const errText = await uazapiRes.text().catch(() => '')
      console.error('UAZAPI send error:', uazapiRes.status, errText)
      return new Response(JSON.stringify({ error: 'Erro ao enviar mensagem.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uazapiData = await uazapiRes.json().catch(() => ({}))
    const uazapi_message_id = uazapiData.messageId || uazapiData.id || `mock_id_${Date.now()}`

    let msgContent = text || `[${type}]`
    if (type === 'location') msgContent = location_name || '[Localizacao]'
    if (type === 'contact') msgContent = `[Contato: ${contact_name}]`
    
    await supabaseAdmin.from('messages').insert({
      tenant_id: profile.tenant_id,
      conversation_id: conversationId,
      direction: 'outbound',
      sender_type: 'human',
      content: msgContent,
      message_type: type,
      uazapi_message_id,
      delivery_status: 'sent',
      media_url: media_url || null,
      media_filename: filename || null,
      latitude: latitude || null,
      longitude: longitude || null
    })

    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq('id', conversationId)

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
