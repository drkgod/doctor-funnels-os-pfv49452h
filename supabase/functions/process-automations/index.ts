import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Campos obrigatorios ausentes.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { event_type, tenant_id, patient_id, context = {} } = body

    if (!event_type || !tenant_id || !patient_id) {
      return new Response(JSON.stringify({ error: 'Campos obrigatorios ausentes.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let query = supabaseAdmin
      .from('automations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)

    if (event_type === 'manual' && context.automation_id) {
      query = query.eq('id', context.automation_id)
    } else if (event_type === 'stage_change') {
      query = query.eq('trigger_type', 'stage_change')
    } else if (event_type.startsWith('appointment_')) {
      query = query.in('trigger_type', ['appointment_event', 'stage_change'])
    }

    const { data: automations, error: autoError } = await query

    if (autoError || !automations || automations.length === 0) {
      console.log(`process-automations: found 0 for event ${event_type}`)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma automacao encontrada para este evento.',
          executions: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`process-automations: found ${automations.length} for event ${event_type}`)

    const toExecute = []

    for (const auto of automations) {
      if (event_type === 'manual') {
        toExecute.push(auto)
        continue
      }

      const tc = (auto.trigger_config as any) || {}

      if (auto.trigger_type === 'stage_change') {
        if (event_type !== 'stage_change') continue
        let matches = true
        if (tc.target_stage && context.new_stage !== tc.target_stage) matches = false
        if (tc.from_stage && tc.from_stage !== 'any' && context.old_stage !== tc.from_stage)
          matches = false
        if (matches) toExecute.push(auto)
      } else if (auto.trigger_type === 'appointment_event') {
        if (tc.event && !event_type.endsWith(tc.event)) continue
        toExecute.push(auto)
      } else if (auto.trigger_type === 'time_after_event') {
        console.log('Skipping time_after_event automation, handled by cron.')
      }
    }

    console.log(`process-automations: after filter, ${toExecute.length} automations to execute.`)

    let executedCount = 0
    const results = []

    for (const auto of toExecute) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recentLog } = await supabaseAdmin
        .from('automation_logs')
        .select('id')
        .eq('automation_id', auto.id)
        .eq('patient_id', patient_id)
        .eq('status', 'success')
        .gte('created_at', oneDayAgo)
        .limit(1)

      if (recentLog && recentLog.length > 0 && event_type !== 'manual') {
        console.log(
          `Skipping automation ${auto.id} already executed for patient ${patient_id} in last 24h.`,
        )
        continue
      }

      let status = 'failed'
      let errorMessage = null

      try {
        const ac = (auto.action_config as any) || {}

        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('full_name, phone, email, pipeline_stage')
          .eq('id', patient_id)
          .single()

        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('name')
          .eq('id', tenant_id)
          .single()

        const replacePlaceholders = (text: string) => {
          if (!text) return ''
          let res = text
            .replace(/PATIENT_NAME/g, patient?.full_name || '')
            .replace(/PATIENT_PHONE/g, patient?.phone || '')
            .replace(/PATIENT_EMAIL/g, patient?.email || '')
            .replace(/PATIENT_STAGE/g, patient?.pipeline_stage || '')
            .replace(/CLINIC_NAME/g, tenant?.name || '')
          if (context.appointment_date)
            res = res.replace(/APPOINTMENT_DATE/g, context.appointment_date)
          if (context.appointment_time)
            res = res.replace(/APPOINTMENT_TIME/g, context.appointment_time)
          return res
        }

        if (auto.action_type === 'send_whatsapp') {
          if (!patient?.phone) {
            errorMessage = 'Paciente sem telefone.'
          } else {
            const message = replacePlaceholders(ac.message || '')

            const wpRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                tenant_id,
                number: patient.phone,
                text: message,
                type: 'text',
              }),
            })

            if (wpRes.ok) {
              status = 'success'
            } else {
              const errTxt = await wpRes.text().catch(() => '')
              errorMessage = `Falha wp: ${errTxt.substring(0, 50)}`
            }
          }
          console.log(`Action send_whatsapp: phone=${patient?.phone} status=${status}`)
        } else if (auto.action_type === 'send_email') {
          if (!patient?.email) {
            errorMessage = 'Paciente sem email.'
          } else {
            let resendApiKey = Deno.env.get('RESEND_API_KEY')
            const secretKey = Deno.env.get('ENCRYPTION_KEY') || 'mock_secret'

            const { data: emailSettings } = await supabaseAdmin
              .from('tenant_email_settings')
              .select('*')
              .eq('tenant_id', tenant_id)
              .eq('provider', 'resend')
              .maybeSingle()

            if (emailSettings && emailSettings.use_custom_key) {
              const { data: tenantKeyRow } = await supabaseAdmin
                .from('tenant_api_keys')
                .select('encrypted_key')
                .eq('tenant_id', tenant_id)
                .eq('provider', 'resend')
                .maybeSingle()

              if (tenantKeyRow) {
                const { data: decryptedToken } = await supabaseAdmin.rpc('decrypt_api_key', {
                  encrypted_value: tenantKeyRow.encrypted_key,
                  secret_key: secretKey,
                })
                if (decryptedToken) resendApiKey = decryptedToken
              }
            }

            if (!resendApiKey) {
              errorMessage = 'Chave API do Resend não encontrada.'
            } else {
              const templateId = ac.template_id
              let htmlContent = ''
              let subject = 'Mensagem da Clínica'

              if (templateId) {
                const { data: tpl } = await supabaseAdmin
                  .from('email_templates')
                  .select('subject, html_content')
                  .eq('id', templateId)
                  .maybeSingle()
                if (tpl) {
                  htmlContent = replacePlaceholders(tpl.html_content)
                  subject = replacePlaceholders(tpl.subject)
                }
              }

              if (!htmlContent) {
                htmlContent = replacePlaceholders(ac.body_template || 'Olá PATIENT_NAME')
              }
              if (ac.subject) subject = replacePlaceholders(ac.subject)

              let fromAddress = `Doctor Funnels <noreply@${Deno.env.get('RESEND_DOMAIN') || 'resend.dev'}>`
              if (emailSettings && emailSettings.from_email && emailSettings.domain_verified) {
                fromAddress = emailSettings.from_name
                  ? `${emailSettings.from_name} <${emailSettings.from_email}>`
                  : emailSettings.from_email
              } else if (emailSettings && emailSettings.from_name) {
                fromAddress = `${emailSettings.from_name} <noreply@${Deno.env.get('RESEND_DOMAIN') || 'resend.dev'}>`
              }

              const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: fromAddress,
                  to: patient.email,
                  subject: subject,
                  html: htmlContent,
                }),
              })

              if (res.ok) {
                status = 'success'
              } else {
                errorMessage = 'Falha ao enviar email pelo Resend.'
              }
            }
          }
          console.log(`Action send_email: to=${patient?.email} status=${status}`)
        } else if (auto.action_type === 'move_pipeline') {
          const targetStage = ac.target_stage
          const validStages = [
            'lead',
            'contact',
            'scheduled',
            'consultation',
            'return',
            'procedure',
          ]
          if (!validStages.includes(targetStage)) {
            errorMessage = 'Etapa invalida.'
          } else if (patient?.pipeline_stage === targetStage) {
            status = 'skipped'
            errorMessage = 'Paciente ja esta nesta etapa.'
          } else {
            await supabaseAdmin
              .from('patients')
              .update({ pipeline_stage: targetStage })
              .eq('id', patient_id)
            status = 'success'
          }
          console.log(
            `Action move_pipeline: patient=${patient_id} from=${patient?.pipeline_stage} to=${targetStage}`,
          )
        } else if (auto.action_type === 'create_task') {
          const title = replacePlaceholders(ac.task_name || 'Nova Tarefa')
          const desc = replacePlaceholders(ac.task_description || '')

          const { error: insertErr } = await supabaseAdmin.from('tasks').insert({
            tenant_id,
            patient_id,
            title,
            description: desc,
            status: 'pending',
            due_date: new Date(Date.now() + (ac.due_days || 1) * 86400000).toISOString(),
          })
          if (insertErr) {
            errorMessage = 'Falha ao criar tarefa: ' + insertErr.message
          } else {
            status = 'success'
          }
          console.log(`Action create_task: title=${title} status=${status}`)
        }
      } catch (e: any) {
        status = 'failed'
        errorMessage = e.message
      }

      await supabaseAdmin.from('automation_logs').insert({
        automation_id: auto.id,
        tenant_id,
        patient_id,
        status,
        error_message: errorMessage,
        executed_at: new Date().toISOString(),
      })

      if (status === 'success') {
        executedCount++
        await supabaseAdmin
          .from('automations')
          .update({
            execution_count: (auto.execution_count || 0) + 1,
            last_executed_at: new Date().toISOString(),
          })
          .eq('id', auto.id)
      }

      results.push({
        automation_id: auto.id,
        automation_name: auto.name,
        action_type: auto.action_type,
        status,
        message: errorMessage,
      })
    }

    console.log(
      `process-automations SUMMARY: event=${event_type} matched=${automations.length} executed=${executedCount}`,
    )

    return new Response(
      JSON.stringify({
        success: true,
        event_type,
        automations_matched: automations.length,
        automations_executed: executedCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('process-automations error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente novamente.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
