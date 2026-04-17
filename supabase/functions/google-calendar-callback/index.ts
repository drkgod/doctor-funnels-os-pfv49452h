import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || ''

  try {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      return Response.redirect(`${FRONTEND_URL}/agenda?gcal=error&reason=dados_ausentes`, 302)
    }

    let stateObj
    try {
      stateObj = JSON.parse(atob(state))
    } catch (e) {
      return Response.redirect(`${FRONTEND_URL}/agenda?gcal=error&reason=sessao_invalida`, 302)
    }

    const { user_id, tenant_id } = stateObj
    if (!user_id || !tenant_id) {
      return Response.redirect(`${FRONTEND_URL}/agenda?gcal=error&reason=sessao_invalida`, 302)
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || ''
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''
    const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || ''
    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'

    const body = new URLSearchParams()
    body.append('code', code)
    body.append('client_id', GOOGLE_CLIENT_ID)
    body.append('client_secret', GOOGLE_CLIENT_SECRET)
    body.append('redirect_uri', GOOGLE_REDIRECT_URI)
    body.append('grant_type', 'authorization_code')

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!tokenRes.ok) {
      return Response.redirect(`${FRONTEND_URL}/agenda?gcal=error&reason=falha_credenciais`, 302)
    }

    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return Response.redirect(`${FRONTEND_URL}/agenda?gcal=error&reason=falha_credenciais`, 302)
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json()
    const email = userData.email

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: encAccess, error: encAccErr } = await supabaseAdmin.rpc('encrypt_api_key', {
      key_value: tokenData.access_token,
      secret_key: ENCRYPTION_KEY,
    })
    if (encAccErr) throw encAccErr

    let encRefresh = null
    if (tokenData.refresh_token) {
      const { data: eRef, error: encRefErr } = await supabaseAdmin.rpc('encrypt_api_key', {
        key_value: tokenData.refresh_token,
        secret_key: ENCRYPTION_KEY,
      })
      if (encRefErr) throw encRefErr
      encRefresh = eRef
    }

    const token_expires_at = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const { data: existing } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('id, metadata')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'google_calendar')
      .single()

    const metadata = {
      refresh_token_encrypted: encRefresh || (existing?.metadata as any)?.refresh_token_encrypted,
      token_expires_at,
      email,
      connected_at: new Date().toISOString(),
      calendar_sync_enabled: true,
    }

    if (existing) {
      await supabaseAdmin
        .from('tenant_api_keys')
        .update({
          encrypted_key: encAccess,
          metadata,
          status: 'active',
        })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin.from('tenant_api_keys').insert({
        tenant_id,
        provider: 'google_calendar',
        encrypted_key: encAccess,
        metadata,
        status: 'active',
      })
    }

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id,
      user_id,
      action: 'google_calendar_connected',
      entity_type: 'tenant_api_keys',
    })

    return Response.redirect(
      `${FRONTEND_URL}/agenda?gcal=success&email=${encodeURIComponent(email)}`,
      302,
    )
  } catch (err) {
    console.error('google-calendar-callback error:', err)
    return Response.redirect(`${FRONTEND_URL}/agenda?gcal=error&reason=erro_servidor`, 302)
  }
})
