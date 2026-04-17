import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'

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
    const { number, text, conversationId } = body
    if (!number || !text || !conversationId) {
      return new Response(JSON.stringify({ error: 'Numero e mensagem sao obrigatorios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (typeof number !== 'string' || !/^\+?[0-9]{10,15}$/.test(number)) {
      return new Response(JSON.stringify({ error: 'Formato de numero invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (typeof text !== 'string' || text.length === 0 || text.length > 4096) {
      return new Response(
        JSON.stringify({ error: 'Mensagem invalida ou excede o tamanho maximo.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
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

    const isRateLimited = await checkRateLimit(
      supabaseAdmin,
      profile.tenant_id,
      'whatsapp-send',
      60,
      1,
    )
    if (isRateLimited) {
      return new Response(
        JSON.stringify({ error: 'Limite de requisicoes atingido. Aguarde alguns minutos.' }),
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

    const uazapiRes = await fetch(`https://${subdomain}.uazapi.com/send/text`, {
      method: 'POST',
      headers: {
        token: decryptedToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number, text, readchat: true }),
    })

    if (!uazapiRes.ok) {
      return new Response(JSON.stringify({ error: 'Erro ao comunicar com o servico.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uazapiData = await uazapiRes.json().catch(() => ({}))
    const uazapi_message_id = uazapiData.messageId || uazapiData.id || `mock_id_${Date.now()}`

    await supabaseAdmin.from('messages').insert({
      tenant_id: profile.tenant_id,
      conversation_id: conversationId,
      direction: 'outbound',
      sender_type: 'human',
      content: text,
      message_type: 'text',
      uazapi_message_id,
      delivery_status: 'sent',
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
    return new Response(JSON.stringify({ error: 'Erro interno do servidor. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
