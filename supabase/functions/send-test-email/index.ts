import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders: Record<string, string> = {
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null)
    if (!body || !body.to) {
      return new Response(JSON.stringify({ error: 'Dados invalidos.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: emailSettings } = await supabaseAdmin.from('tenant_email_settings').select('*').eq('tenant_id', profile.tenant_id).eq('provider', 'resend').maybeSingle()
    
    let resendApiKey = null
    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'

    if (emailSettings && emailSettings.use_custom_key) {
      const { data: tenantKeyRow } = await supabaseAdmin.from('tenant_api_keys').select('encrypted_key').eq('tenant_id', profile.tenant_id).eq('provider', 'resend').maybeSingle()
      if (tenantKeyRow) {
        const { data: decryptedToken } = await supabaseAdmin.rpc('decrypt_api_key', { encrypted_value: tenantKeyRow.encrypted_key, secret_key: secretKey })
        if (decryptedToken) resendApiKey = decryptedToken
      }
    }

    if (!resendApiKey) resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Servico de email nao configurado.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let fromAddress = `Doctor Funnels <noreply@${Deno.env.get('RESEND_DOMAIN') || 'resend.dev'}>`
    if (emailSettings && emailSettings.from_email && emailSettings.domain_verified) {
      fromAddress = emailSettings.from_name ? `${emailSettings.from_name} <${emailSettings.from_email}>` : emailSettings.from_email
    } else if (emailSettings && emailSettings.from_name) {
      fromAddress = `${emailSettings.from_name} <noreply@${Deno.env.get('RESEND_DOMAIN') || 'resend.dev'}>`
    }

    const replyTo = emailSettings?.reply_to || null

    const resendPayload: any = {
      from: fromAddress,
      to: body.to,
      subject: 'Teste de Configuração de E-mail',
      html: '<p>Este é um e-mail de teste para confirmar que as configurações da sua clínica estão funcionando corretamente no Doctor Funnels OS.</p>',
    }
    if (replyTo) resendPayload.reply_to = replyTo

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendPayload),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return new Response(JSON.stringify({ error: `Falha ao enviar: ${errText.substring(0, 100)}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
