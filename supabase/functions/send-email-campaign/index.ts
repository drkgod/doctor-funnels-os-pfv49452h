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
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessao invalida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const { campaign_id } = body

    if (!campaign_id || typeof campaign_id !== 'string' || !isUUID(campaign_id)) {
      return new Response(
        JSON.stringify({ error: 'Identificador da campanha invalido ou ausente.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isRateLimited = await checkRateLimit(
      supabaseAdmin,
      profile.tenant_id,
      'email-campaign',
      5,
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

    const { data: module } = await supabaseAdmin
      .from('tenant_modules')
      .select('is_enabled, limits')
      .eq('tenant_id', profile.tenant_id)
      .eq('module_key', 'email')
      .single()

    if (!module?.is_enabled) {
      return new Response(JSON.stringify({ error: 'Modulo Email nao disponivel.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: campaign } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (!campaign) {
      return new Response(JSON.stringify({ error: 'Campanha nao encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return new Response(
        JSON.stringify({ error: 'Esta campanha ja foi enviada ou esta em processamento.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: apiKeyRow } = await supabaseAdmin
      .from('tenant_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', profile.tenant_id)
      .eq('provider', 'resend')
      .single()

    if (!apiKeyRow) {
      return new Response(JSON.stringify({ error: 'Servico de envio nao configurado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
    const { data: decryptedToken, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_api_key',
      {
        encrypted_value: apiKeyRow.encrypted_key,
        secret_key: secretKey,
      },
    )

    if (decryptError || !decryptedToken) {
      return new Response(JSON.stringify({ error: 'Erro ao processar credenciais.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: template } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', campaign.template_id)
      .single()

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template nao encontrado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let query = supabaseAdmin
      .from('patients')
      .select('email, full_name')
      .eq('tenant_id', profile.tenant_id)
      .not('email', 'is', null)
      .is('deleted_at', null)
      .limit(500)

    if (campaign.segment_filter) {
      const filters = campaign.segment_filter as any
      if (filters.pipeline_stage && filters.pipeline_stage.length > 0)
        query = query.in('pipeline_stage', filters.pipeline_stage)
      if (filters.source && filters.source.length > 0) query = query.in('source', filters.source)
      if (filters.tags && filters.tags.length > 0) query = query.contains('tags', filters.tags)
    }

    const { data: patients, error: patientsError } = await query
    if (patientsError || !patients) {
      return new Response(JSON.stringify({ error: 'Erro ao recuperar destinatarios.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const validPatients = patients.filter(
      (p) => p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email),
    )
    const recipientCount = validPatients.length

    if (recipientCount === 0) {
      return new Response(
        JSON.stringify({
          error: 'Nenhum destinatario com email valido encontrado para esta segmentacao.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    const monthStr = firstDayOfMonth.toISOString().split('T')[0]

    const { data: usage } = await supabaseAdmin
      .from('tenant_email_usage')
      .select('emails_sent, id')
      .eq('tenant_id', profile.tenant_id)
      .eq('month', monthStr)
      .maybeSingle()

    const sentThisMonth = usage?.emails_sent || 0
    const limitParams = module.limits as any
    const limit = limitParams?.max_emails_month || 1000

    if (sentThisMonth + recipientCount > limit) {
      return new Response(
        JSON.stringify({
          error: `Limite de uso atingido. Maximo permitido: ${limit}. Tentativa de envio excede o limite.`,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    await supabaseAdmin.from('email_campaigns').update({ status: 'sending' }).eq('id', campaign_id)

    const { data: tenantInfo } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', profile.tenant_id)
      .single()

    let successfulCount = 0
    let failedCount = 0
    const BATCH_SIZE = 10

    for (let i = 0; i < validPatients.length; i += BATCH_SIZE) {
      const batch = validPatients.slice(i, i + BATCH_SIZE)
      const emailPromises = batch.map(async (patient) => {
        let content = template.html_content
        let subject = template.subject

        content = content.replace(/PATIENT_NAME/g, patient.full_name || '')
        content = content.replace(/PATIENT_EMAIL/g, patient.email || '')
        content = content.replace(/CLINIC_NAME/g, tenantInfo?.name || '')
        content = content.replace(/DOCTOR_NAME/g, profile.full_name || '')

        subject = subject.replace(/PATIENT_NAME/g, patient.full_name || '')
        subject = subject.replace(/PATIENT_EMAIL/g, patient.email || '')
        subject = subject.replace(/CLINIC_NAME/g, tenantInfo?.name || '')
        subject = subject.replace(/DOCTOR_NAME/g, profile.full_name || '')

        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${decryptedToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `noreply@${Deno.env.get('RESEND_DOMAIN') || 'resend.dev'}`,
              to: patient.email,
              subject: subject,
              html: content,
            }),
          })
          if (res.ok) {
            successfulCount++
          } else {
            failedCount++
          }
        } catch (e) {
          failedCount++
        }
      })

      await Promise.all(emailPromises)
      if (i + BATCH_SIZE < validPatients.length) await new Promise((r) => setTimeout(r, 100))
    }

    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'sent', sent_count: successfulCount })
      .eq('id', campaign_id)

    if (usage?.id) {
      await supabaseAdmin
        .from('tenant_email_usage')
        .update({ emails_sent: sentThisMonth + successfulCount })
        .eq('id', usage.id)
    } else {
      await supabaseAdmin
        .from('tenant_email_usage')
        .insert({ tenant_id: profile.tenant_id, month: monthStr, emails_sent: successfulCount })
    }

    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: profile.tenant_id,
      action: 'email_campaign_sent',
      entity_type: 'email_campaigns',
      entity_id: campaign_id,
      details: { sent_count: successfulCount, failed_count: failedCount },
      user_id: user.id,
    })

    return new Response(
      JSON.stringify({ success: true, sent_count: successfulCount, failed_count: failedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('send-email-campaign error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
