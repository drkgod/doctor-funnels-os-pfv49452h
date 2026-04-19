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

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Envie os dados no formato JSON.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { campaign_id, to, subject, html } = body

    if (to !== undefined || subject !== undefined || html !== undefined) {
      if (
        typeof to !== 'string' ||
        !to.includes('@') ||
        to.trim() === '' ||
        typeof subject !== 'string' ||
        subject.trim() === '' ||
        typeof html !== 'string' ||
        html.trim() === ''
      ) {
        return new Response(JSON.stringify({ error: 'Dados de email invalidos.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (!campaign_id || typeof campaign_id !== 'string' || campaign_id.length !== 36) {
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

    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count } = await supabaseAdmin
      .from('email_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', oneHourAgo)

    if ((count || 0) > 5) {
      return new Response(JSON.stringify({ error: 'Limite de campanhas atingido. Aguarde.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

    const { data: emailSettings, error: emailSettingsError } = await supabaseAdmin
      .from('tenant_email_settings')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('provider', 'resend')
      .maybeSingle()

    if (emailSettingsError) {
      console.log('Email settings query error:', emailSettingsError.message)
    }

    let resendApiKey = null
    const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret_for_preview'
    let keyType = 'platform_key'

    if (emailSettings && emailSettings.use_custom_key) {
      const { data: tenantKeyRow } = await supabaseAdmin
        .from('tenant_api_keys')
        .select('encrypted_key')
        .eq('tenant_id', profile.tenant_id)
        .eq('provider', 'resend')
        .maybeSingle()

      if (tenantKeyRow) {
        const { data: decryptedToken, error: decryptError } = await supabaseAdmin.rpc(
          'decrypt_api_key',
          {
            encrypted_value: tenantKeyRow.encrypted_key,
            secret_key: secretKey,
          },
        )
        if (!decryptError && decryptedToken) {
          resendApiKey = decryptedToken
          keyType = 'tenant_key'
        }
      }
    }

    if (!resendApiKey) {
      resendApiKey = Deno.env.get('RESEND_API_KEY')
    }

    if (!resendApiKey) {
      console.log(`No Resend API key available for tenant: ${profile.tenant_id}`)
      return new Response(
        JSON.stringify({
          error:
            'Servico de email nao configurado. Configure sua chave de API de email nas configuracoes.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    let fromAddress = `Doctor Funnels <noreply@${Deno.env.get('RESEND_DOMAIN') || 'resend.dev'}>`

    if (emailSettings && emailSettings.from_email && emailSettings.domain_verified) {
      fromAddress = emailSettings.from_name
        ? `${emailSettings.from_name} <${emailSettings.from_email}>`
        : emailSettings.from_email
    } else if (emailSettings && emailSettings.from_name) {
      fromAddress = `${emailSettings.from_name} <noreply@${Deno.env.get('RESEND_DOMAIN') || 'resend.dev'}>`
    }

    console.log(`Email config: using=${keyType} from_email=${fromAddress}`)

    const replyTo = emailSettings?.reply_to || null

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
          const resendPayload: any = {
            from: fromAddress,
            to: patient.email,
            subject: subject,
            html: content,
          }
          if (replyTo) {
            resendPayload.reply_to = replyTo
          }

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(resendPayload),
          })
          if (res.ok) {
            successfulCount++
          } else {
            failedCount++
            const errText = await res.text().catch(() => '')
            console.log(
              `Resend API error for ${patient.email} Status: ${res.status} Body: ${errText.substring(0, 300)}`,
            )

            if (errText.includes('API key is invalid') || errText.includes('Invalid API Key')) {
              console.log(`INVALID RESEND API KEY for tenant: ${profile.tenant_id}`)
            }
            if (errText.includes('not verified') || errText.includes('not a verified')) {
              console.log(
                `DOMAIN NOT VERIFIED for tenant: ${profile.tenant_id} from: ${fromAddress}`,
              )
            }
            if (errText.includes('can only send') || errText.includes('testing')) {
              console.log(`RESEND IN SANDBOX MODE for tenant: ${profile.tenant_id}`)
            }
          }
        } catch (e) {
          failedCount++
          console.log(`Fetch exception for ${patient.email}:`, e)
        }
      })

      await Promise.all(emailPromises)
      if (i + BATCH_SIZE < validPatients.length) await new Promise((r) => setTimeout(r, 100))
    }

    if (successfulCount === 0 && failedCount > 0) {
      await supabaseAdmin.from('email_campaigns').update({ status: 'draft' }).eq('id', campaign_id)
      console.log(`Campaign failed completely. Reset to draft. ID: ${campaign_id}`)

      return new Response(
        JSON.stringify({
          success: false,
          sent_count: 0,
          failed_count: failedCount,
          warning: 'Nenhum email enviado. Verifique as configuracoes de email.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
