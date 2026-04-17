import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      body = {}
    }
    const { action } = body

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || ''
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''
    const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || ''
    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()
    const tenant_id = profile?.tenant_id

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'Dados nao identificados.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (action === 'get_auth_url') {
      const stateObj = { user_id: user.id, tenant_id }
      const stateStr = btoa(JSON.stringify(stateObj))

      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
      url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set(
        'scope',
        'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
      )
      url.searchParams.set('access_type', 'offline')
      url.searchParams.set('prompt', 'consent')
      url.searchParams.set('state', stateStr)

      return new Response(JSON.stringify({ auth_url: url.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'refresh_token') {
      const { data: keyData } = await supabaseAdmin
        .from('tenant_api_keys')
        .select('metadata')
        .eq('tenant_id', tenant_id)
        .eq('provider', 'google_calendar')
        .single()
      if (!keyData)
        return new Response(JSON.stringify({ error: 'Servico nao conectado.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      const refreshEncrypted = (keyData.metadata as any)?.refresh_token_encrypted
      if (!refreshEncrypted) {
        return new Response(JSON.stringify({ error: 'Credenciais indisponiveis.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: decryptRes, error: decErr } = await supabaseAdmin.rpc('decrypt_api_key', {
        encrypted_value: refreshEncrypted,
        secret_key: ENCRYPTION_KEY,
      })
      if (decErr || !decryptRes) {
        return new Response(JSON.stringify({ error: 'Erro ao processar configuracoes.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const bodyParams = new URLSearchParams()
      bodyParams.append('client_id', GOOGLE_CLIENT_ID)
      bodyParams.append('client_secret', GOOGLE_CLIENT_SECRET)
      bodyParams.append('refresh_token', decryptRes)
      bodyParams.append('grant_type', 'refresh_token')

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams,
      })

      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ error: 'Falha na atualizacao das credenciais.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const tokenData = await tokenRes.json()

      const { data: encAccess, error: encErr } = await supabaseAdmin.rpc('encrypt_api_key', {
        key_value: tokenData.access_token,
        secret_key: ENCRYPTION_KEY,
      })
      if (encErr) {
        return new Response(JSON.stringify({ error: 'Erro ao processar configuracoes.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const token_expires_at = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

      await supabaseAdmin
        .from('tenant_api_keys')
        .update({
          encrypted_key: encAccess,
          metadata: { ...(keyData.metadata as any), token_expires_at },
        })
        .eq('tenant_id', tenant_id)
        .eq('provider', 'google_calendar')

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'disconnect') {
      await supabaseAdmin
        .from('tenant_api_keys')
        .delete()
        .eq('tenant_id', tenant_id)
        .eq('provider', 'google_calendar')
      await supabaseAdmin
        .from('audit_logs')
        .insert({ action: 'google_calendar_disconnected', tenant_id, user_id: user.id })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'check_status') {
      const { data: keyData } = await supabaseAdmin
        .from('tenant_api_keys')
        .select('metadata')
        .eq('tenant_id', tenant_id)
        .eq('provider', 'google_calendar')
        .single()
      if (!keyData)
        return new Response(JSON.stringify({ connected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      const meta = keyData.metadata as any
      return new Response(
        JSON.stringify({ connected: true, email: meta?.email, connected_at: meta?.connected_at }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ error: 'Acao invalida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('google-calendar-auth error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
