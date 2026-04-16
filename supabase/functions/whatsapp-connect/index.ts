import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
      return new Response(JSON.stringify({ error: 'Chave API nao encontrada' }), {
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
      return new Response(JSON.stringify({ error: 'Erro ao descriptografar token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subdomain = (apiKey.metadata as any)?.subdomain
    if (!subdomain)
      return new Response(JSON.stringify({ error: 'Subdominio nao configurado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const uazapiRes = await fetch(`https://${subdomain}.uazapi.com/instance/connect`, {
      method: 'POST',
      headers: {
        token: decryptedToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (uazapiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Limite atingido. Tente novamente mais tarde.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!uazapiRes.ok) {
      return new Response(
        JSON.stringify({
          error: 'Instancia nao disponivel. Verifique a configuracao no painel administrativo.',
          fallback: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    let uazapiData
    try {
      uazapiData = await uazapiRes.json()
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: 'Instancia nao disponivel. Verifique a configuracao no painel administrativo.',
          fallback: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    return new Response(JSON.stringify(uazapiData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro ao conectar WhatsApp. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
