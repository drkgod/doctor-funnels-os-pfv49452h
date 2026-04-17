import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    let body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      body = {}
    }

    let target_tenant_id = null

    if (body.tenant_id) {
      if (typeof body.tenant_id !== 'string' || body.tenant_id.length !== 36) {
        return new Response(JSON.stringify({ error: 'Tenant ID invalido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (profile?.role === 'super_admin') {
        target_tenant_id = body.tenant_id
      } else {
        target_tenant_id = profile?.tenant_id
      }
    } else {
      target_tenant_id = profile?.tenant_id
    }

    if (!target_tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant nao identificado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: keyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key, metadata')
      .eq('tenant_id', target_tenant_id)
      .eq('provider', 'uazapi')
      .maybeSingle()

    if (!keyData) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'not_configured',
          configured: false,
          message: 'WhatsApp nao configurado para este tenant.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const secret = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
    const { data: decryptedToken, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_api_key',
      {
        encrypted_value: keyData.encrypted_key,
        secret_key: secret,
      },
    )

    if (decryptError || !decryptedToken) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'error',
          configured: true,
          message: 'Erro ao processar solicitacao.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    let metadata = keyData.metadata
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata)
      } catch (e) {
        // ignore
      }
    }

    const subdomain = (metadata as any)?.subdomain || Deno.env.get('WHATSAPP_SUBDOMAIN')
    if (!subdomain) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'error',
          configured: true,
          message: 'Erro ao conectar com servico.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const uazapiRes = await fetch(`https://${subdomain}.uazapi.com/instance/status`, {
      method: 'GET',
      headers: {
        token: decryptedToken,
      },
    }).catch(() => null)

    if (!uazapiRes || !uazapiRes.ok) {
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'error',
          configured: true,
          message: 'Erro ao conectar com servico externo.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const uazapiData = await uazapiRes.json().catch(() => ({}))

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        ...uazapiData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('whatsapp-status error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
