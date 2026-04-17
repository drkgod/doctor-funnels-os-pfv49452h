import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'

const isUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)

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

    const body = await req.json().catch(() => ({}))
    let target_tenant_id = null

    if (body.tenant_id) {
      if (!isUUID(body.tenant_id)) {
        return new Response(JSON.stringify({ error: 'Formato de identificador invalido.' }), {
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

    const isRateLimited = await checkRateLimit(
      supabaseAdmin,
      target_tenant_id,
      'whatsapp-connect',
      10,
      60,
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

    await supabaseAdmin
      .from('audit_logs')
      .insert({ tenant_id: target_tenant_id, user_id: user.id, action: 'whatsapp_connect_attempt' })

    const { data: keyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key, metadata')
      .eq('tenant_id', target_tenant_id)
      .eq('provider', 'uazapi')
      .maybeSingle()

    if (!keyData) {
      return new Response(
        JSON.stringify({
          error: 'Instancia UAZAPI nao configurada para este tenant. Solicite ao administrador.',
        }),
        {
          status: 400,
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
      return new Response(JSON.stringify({ error: 'Erro ao processar solicitacao.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
      return new Response(JSON.stringify({ error: 'Servico nao configurado.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uazapiRes = await fetch(`https://${subdomain}.uazapi.com/instance/connect`, {
      method: 'POST',
      headers: {
        token: decryptedToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }).catch(() => null)

    if (!uazapiRes || !uazapiRes.ok) {
      return new Response(
        JSON.stringify({
          error: 'Erro ao comunicar com o servico. Tente novamente em alguns segundos.',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const uazapiData = await uazapiRes.json().catch(() => ({}))

    return new Response(
      JSON.stringify({
        success: true,
        ...uazapiData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('whatsapp-connect error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
