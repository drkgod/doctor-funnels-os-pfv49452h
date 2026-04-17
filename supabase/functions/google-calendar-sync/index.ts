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
      return new Response(JSON.stringify({ error: 'Sessao invalida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const bodyObj = await req.json().catch(() => null)
    if (!bodyObj || typeof bodyObj !== 'object') {
      return new Response(JSON.stringify({ error: 'Corpo da requisicao invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { action, timeMin, timeMax, event_data, event_id } = bodyObj

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

    const { data: keyData } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('id, encrypted_key, metadata')
      .eq('tenant_id', tenant_id)
      .eq('provider', 'google_calendar')
      .single()
    if (!keyData)
      return new Response(JSON.stringify({ error: 'Servico nao conectado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'

    let { data: accessToken } = await supabaseAdmin.rpc('decrypt_api_key', {
      encrypted_value: keyData.encrypted_key,
      secret_key: ENCRYPTION_KEY,
    })

    let metadata = keyData.metadata as any
    const expiresAt = new Date(metadata.token_expires_at).getTime()

    if (Date.now() > expiresAt - 5 * 60 * 1000) {
      const { data: refDec } = await supabaseAdmin.rpc('decrypt_api_key', {
        encrypted_value: metadata.refresh_token_encrypted,
        secret_key: ENCRYPTION_KEY,
      })

      const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || ''
      const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''

      const bodyParams = new URLSearchParams()
      bodyParams.append('client_id', GOOGLE_CLIENT_ID)
      bodyParams.append('client_secret', GOOGLE_CLIENT_SECRET)
      bodyParams.append('refresh_token', refDec)
      bodyParams.append('grant_type', 'refresh_token')

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams,
      })
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json()
        const { data: encAccess } = await supabaseAdmin.rpc('encrypt_api_key', {
          key_value: tokenData.access_token,
          secret_key: ENCRYPTION_KEY,
        })
        const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        metadata.token_expires_at = newExpiry
        await supabaseAdmin
          .from('tenant_api_keys')
          .update({ encrypted_key: encAccess, metadata })
          .eq('id', keyData.id)
        accessToken = tokenData.access_token
      }
    }

    const fetchGoogle = async (url: string, method: string, payload?: any) => {
      let res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      })
      if (res.status === 401) {
        const { data: refDec } = await supabaseAdmin.rpc('decrypt_api_key', {
          encrypted_value: metadata.refresh_token_encrypted,
          secret_key: ENCRYPTION_KEY,
        })
        const bp = new URLSearchParams()
        bp.append('client_id', Deno.env.get('GOOGLE_CLIENT_ID') || '')
        bp.append('client_secret', Deno.env.get('GOOGLE_CLIENT_SECRET') || '')
        bp.append('refresh_token', refDec)
        bp.append('grant_type', 'refresh_token')

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bp,
        })
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json()
          accessToken = tokenData.access_token
          const { data: encAccess } = await supabaseAdmin.rpc('encrypt_api_key', {
            key_value: accessToken,
            secret_key: ENCRYPTION_KEY,
          })
          metadata.token_expires_at = new Date(
            Date.now() + tokenData.expires_in * 1000,
          ).toISOString()
          await supabaseAdmin
            .from('tenant_api_keys')
            .update({ encrypted_key: encAccess, metadata })
            .eq('id', keyData.id)

          res = await fetch(url, {
            method,
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: payload ? JSON.stringify(payload) : undefined,
          })
        }
      }
      return res
    }

    if (action === 'list_events') {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
      url.searchParams.set('timeMin', timeMin)
      url.searchParams.set('timeMax', timeMax)
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')
      url.searchParams.set('maxResults', '250')

      const res = await fetchGoogle(url.toString(), 'GET')
      if (res.status === 401)
        return new Response(
          JSON.stringify({
            error: 'Sessao externa expirou. Reconecte o servico.',
          }),
          { status: 401, headers: corsHeaders },
        )
      if (res.status === 403)
        return new Response(JSON.stringify({ error: 'Acesso negado ao servico externo.' }), {
          status: 403,
          headers: corsHeaders,
        })
      if (!res.ok)
        return new Response(JSON.stringify({ error: 'Falha na sincronizacao. Tente novamente.' }), {
          status: 502,
          headers: corsHeaders,
        })

      const data = await res.json()
      return new Response(JSON.stringify(data.items || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create_event') {
      const payloadObj = {
        summary: event_data.summary,
        start: { dateTime: event_data.start_datetime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: event_data.end_datetime, timeZone: 'America/Sao_Paulo' },
        description: event_data.description,
        attendees: event_data.attendees
          ? event_data.attendees.map((e: string) => ({ email: e }))
          : undefined,
      }
      const res = await fetchGoogle(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        'POST',
        payloadObj,
      )
      if (res.status === 401)
        return new Response(
          JSON.stringify({
            error: 'Sessao externa expirou. Reconecte o servico.',
          }),
          { status: 401, headers: corsHeaders },
        )
      if (!res.ok)
        return new Response(JSON.stringify({ error: 'Falha na sincronizacao. Tente novamente.' }), {
          status: 502,
          headers: corsHeaders,
        })
      const data = await res.json()
      return new Response(JSON.stringify({ id: data.id, htmlLink: data.htmlLink }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update_event') {
      const payloadObj = {
        ...(event_data.summary && { summary: event_data.summary }),
        ...(event_data.start_datetime && {
          start: { dateTime: event_data.start_datetime, timeZone: 'America/Sao_Paulo' },
        }),
        ...(event_data.end_datetime && {
          end: { dateTime: event_data.end_datetime, timeZone: 'America/Sao_Paulo' },
        }),
        ...(event_data.description !== undefined && { description: event_data.description }),
        ...(event_data.attendees && {
          attendees: event_data.attendees.map((e: string) => ({ email: e })),
        }),
      }
      const res = await fetchGoogle(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}`,
        'PATCH',
        payloadObj,
      )
      if (res.status === 401)
        return new Response(
          JSON.stringify({
            error: 'Sessao externa expirou. Reconecte o servico.',
          }),
          { status: 401, headers: corsHeaders },
        )
      if (res.status === 404)
        return new Response(
          JSON.stringify({ error: 'Registro nao encontrado no servico externo.' }),
          { status: 404, headers: corsHeaders },
        )
      if (!res.ok)
        return new Response(JSON.stringify({ error: 'Falha na sincronizacao. Tente novamente.' }), {
          status: 502,
          headers: corsHeaders,
        })
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete_event') {
      const res = await fetchGoogle(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event_id}`,
        'DELETE',
      )
      if (res.status === 401)
        return new Response(
          JSON.stringify({
            error: 'Sessao externa expirou. Reconecte o servico.',
          }),
          { status: 401, headers: corsHeaders },
        )
      if (res.status === 404)
        return new Response(
          JSON.stringify({ error: 'Registro nao encontrado no servico externo.' }),
          { status: 404, headers: corsHeaders },
        )
      if (!res.ok)
        return new Response(JSON.stringify({ error: 'Falha na sincronizacao. Tente novamente.' }), {
          status: 502,
          headers: corsHeaders,
        })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Comando invalido.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('google-calendar-sync error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
