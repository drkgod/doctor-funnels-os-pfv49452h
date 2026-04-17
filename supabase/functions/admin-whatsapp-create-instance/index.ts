import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

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
      return new Response(JSON.stringify({ error: 'Nao autorizado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Envie os dados no formato JSON.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { tenant_id, instance_token, custom_subdomain, reconfigure_webhook } = body

    if (typeof tenant_id !== 'string' || tenant_id.length !== 36) {
      return new Response(JSON.stringify({ error: 'Dados invalidos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-uazapi-webhook?tenant_id=${tenant_id}`

    if (reconfigure_webhook) {
      const { data: keyData } = await supabaseAdmin
        .from('tenant_api_keys')
        .select('encrypted_key, metadata')
        .eq('tenant_id', tenant_id)
        .eq('provider', 'uazapi')
        .maybeSingle()

      if (!keyData) {
        return new Response(JSON.stringify({ error: 'Instancia nao encontrada.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const secret = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
      const { data: decryptedToken, error: decryptError } = await supabaseAdmin.rpc('decrypt_api_key', {
        encrypted_value: keyData.encrypted_key,
        secret_key: secret,
      })

      if (decryptError || !decryptedToken) {
        return new Response(JSON.stringify({ error: 'Erro ao descriptografar token.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let metadata = keyData.metadata
      if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata) } catch (e) {}
      }
      const subdomain = (metadata as any)?.subdomain || custom_subdomain || Deno.env.get('WHATSAPP_SUBDOMAIN')

      if (!subdomain) {
        return new Response(JSON.stringify({ error: 'Subdominio UAZAPI nao encontrado.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let webhook_ok = false
      const events = ['messages', 'status', 'connection']

      // Approach A
      let webhookRes = await fetch(`https://${subdomain}.uazapi.com/instance/webhook`, {
        method: 'POST',
        headers: { token: decryptedToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, events }),
      }).catch(() => null)

      if (webhookRes?.ok) {
        webhook_ok = true
      } else {
        // Approach B
        webhookRes = await fetch(`https://${subdomain}.uazapi.com/instance/webhook`, {
          method: 'POST',
          headers: { token: decryptedToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl, enabled: true, events }),
        }).catch(() => null)

        if (webhookRes?.ok) {
          webhook_ok = true
        } else {
          // Approach C
          webhookRes = await fetch(`https://${subdomain}.uazapi.com/instance/webhook`, {
            method: 'PUT',
            headers: { token: decryptedToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook_url: webhookUrl, webhook_enabled: true, webhook_events: events }),
          }).catch(() => null)

          if (webhookRes?.ok) {
            webhook_ok = true
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          webhook_configured: webhook_ok,
          webhook_url: webhookUrl,
          message: webhook_ok 
            ? 'Webhook reconfigurado com sucesso.' 
            : 'Webhook nao configurado automaticamente. Configure manualmente no painel UAZAPI com a URL acima.'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (
      typeof instance_token !== 'string' ||
      instance_token.length < 10 ||
      instance_token.length > 200
    ) {
      return new Response(JSON.stringify({ error: 'Dados invalidos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subdomain = custom_subdomain || Deno.env.get('WHATSAPP_SUBDOMAIN')
    if (!subdomain) {
      return new Response(JSON.stringify({ error: 'Subdominio UAZAPI nao configurado.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const statusRes = await fetch(`https://${subdomain}.uazapi.com/instance/status`, {
      method: 'GET',
      headers: { token: instance_token },
    }).catch(() => null)

    if (!statusRes || !statusRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Erro ao configurar instancia. Verifique o token.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const secret = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
    const { data: encryptedKey, error: encryptError } = await supabaseAdmin.rpc('encrypt_api_key', {
      key_value: instance_token,
      secret_key: secret,
    })

    if (encryptError || !encryptedKey) {
      return new Response(JSON.stringify({ error: 'Erro ao processar solicitacao.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const metadataObj = {
      subdomain,
      connected: false,
      configured_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseAdmin.from('tenant_api_keys').upsert(
      {
        tenant_id,
        provider: 'uazapi',
        encrypted_key: encryptedKey,
        metadata: metadataObj,
        status: 'active',
      },
      { onConflict: 'tenant_id,provider' },
    )

    if (upsertError) {
      return new Response(JSON.stringify({ error: 'Erro ao processar solicitacao.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let webhook_ok = false
    const events = ['messages', 'status', 'connection']

    let webhookRes = await fetch(`https://${subdomain}.uazapi.com/instance/webhook`, {
      method: 'POST',
      headers: { token: instance_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, events }),
    }).catch(() => null)

    if (webhookRes?.ok) {
      webhook_ok = true
    } else {
      webhookRes = await fetch(`https://${subdomain}.uazapi.com/instance/webhook`, {
        method: 'POST',
        headers: { token: instance_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, enabled: true, events }),
      }).catch(() => null)

      if (webhookRes?.ok) {
        webhook_ok = true
      } else {
        webhookRes = await fetch(`https://${subdomain}.uazapi.com/instance/webhook`, {
          method: 'PUT',
          headers: { token: instance_token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhook_url: webhookUrl, webhook_enabled: true, webhook_events: events }),
        }).catch(() => null)

        if (webhookRes?.ok) {
          webhook_ok = true
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Instancia UAZAPI configurada com sucesso',
        webhook_configured: webhook_ok,
        webhook_url: webhookUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {
    console.error('admin-whatsapp-create-instance error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
