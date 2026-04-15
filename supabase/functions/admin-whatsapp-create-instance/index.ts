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
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'super_admin')
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const { tenant_id } = await req.json()
    if (!tenant_id)
      return new Response(JSON.stringify({ error: 'tenant_id missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const uazapiSubdomain = Deno.env.get('UAZAPI_SUBDOMAIN')
    const uazapiAdminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN')
    const webhookBaseUrl = Deno.env.get('WEBHOOK_BASE_URL')
    const secret = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'

    let instanceToken = 'mock_token_' + Date.now()
    let webhookConfigured = false

    if (uazapiSubdomain && uazapiAdminToken) {
      const createRes = await fetch(`https://${uazapiSubdomain}.uazapi.com/admin/instance/create`, {
        method: 'POST',
        headers: { admintoken: uazapiAdminToken },
      })
      if (!createRes.ok)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar instancia WhatsApp. Tente novamente.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      const createData = await createRes.json()
      if (createData.token) instanceToken = createData.token
    }

    const { data: encrypted, error: rpcError } = await supabaseAdmin.rpc('encrypt_api_key', {
      key_value: instanceToken,
      secret_key: secret,
    })
    if (rpcError) throw rpcError

    const { error: insertError } = await supabaseAdmin.from('tenant_api_keys').insert({
      tenant_id,
      provider: 'uazapi',
      encrypted_key: encrypted,
      status: 'active',
      metadata: {
        subdomain: uazapiSubdomain || 'mock',
        instance_status: 'disconnected',
        webhook_configured: false,
        phone_number: null,
        last_disconnection_reason: null,
        connected_at: null,
      },
    })
    if (insertError) throw insertError

    if (uazapiSubdomain && webhookBaseUrl) {
      const webhookRes = await fetch(`https://${uazapiSubdomain}.uazapi.com/webhook`, {
        method: 'POST',
        headers: { token: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          url: `${webhookBaseUrl}/functions/v1/handle-uazapi-webhook`,
          events: ['messages', 'connection', 'messages_update'],
          excludeMessages: ['wasSentByApi'],
        }),
      })
      if (webhookRes.ok) webhookConfigured = true
    } else {
      webhookConfigured = true
    }

    if (webhookConfigured) {
      await supabaseAdmin
        .from('tenant_api_keys')
        .update({
          metadata: {
            subdomain: uazapiSubdomain || 'mock',
            instance_status: 'disconnected',
            webhook_configured: true,
            phone_number: null,
            last_disconnection_reason: null,
            connected_at: null,
          },
        })
        .eq('tenant_id', tenant_id)
        .eq('provider', 'uazapi')
    }

    await supabaseAdmin
      .from('audit_logs')
      .insert({
        tenant_id,
        action: 'whatsapp_instance_created',
        entity_type: 'tenant_api_keys',
        user_id: user.id,
      })

    return new Response(JSON.stringify({ success: true, instance_status: 'disconnected' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
