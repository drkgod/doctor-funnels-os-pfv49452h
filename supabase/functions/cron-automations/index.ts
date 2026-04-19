// To enable cron, run this SQL in Supabase SQL Editor:
// SELECT cron.schedule(
//   'process-time-automations',
//   '*/30 * * * *',
//   $$
//   SELECT net.http_post(
//     url := 'YOUR_SUPABASE_URL/functions/v1/cron-automations',
//     headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY', 'Content-Type', 'application/json'),
//     body := '{}'::jsonb
//   ) AS request_id;
//   $$
// );
// 
// To check cron jobs:
// SELECT * FROM cron.job;
//
// To remove:
// SELECT cron.unschedule('process-time-automations');

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: automations, error: autoError } = await supabaseAdmin
      .from('automations')
      .select('*')
      .eq('is_active', true)
      .eq('trigger_type', 'time_after_event')

    if (autoError || !automations || automations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma automacao temporal ativa.',
          processed: 0
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`cron-automations: found ${automations.length} active time_after_event automations.`)

    let total_executed = 0
    let total_skipped = 0
    let total_failed = 0
    let total_patients_due = 0

    for (const auto of automations) {
      const tc = auto.trigger_config as any || {}
      const eventType = tc.event_type
      const delayDays = tc.delay_days || 0
      const delayHours = tc.delay_hours || 0
      const targetStage = tc.target_stage
      const excludeStages = tc.exclude_stages || []

      const patientEvents = new Map<string, { event_time: string, full_name: string, pipeline_stage: string }>()

      if (eventType === 'appointment_completed') {
        const { data: appts } = await supabaseAdmin.from('appointments')
          .select('patient_id, datetime_end, patients!inner(full_name, pipeline_stage)')
          .eq('tenant_id', auto.tenant_id)
          .eq('status', 'completed')
          .not('datetime_end', 'is', null)
          .order('datetime_end', { ascending: true })

        if (appts) {
          for (const a of appts) {
            if (a.patient_id && a.patients) {
              patientEvents.set(a.patient_id, {
                event_time: a.datetime_end,
                full_name: (a.patients as any).full_name,
                pipeline_stage: (a.patients as any).pipeline_stage
              })
            }
          }
        }
      } else if (eventType === 'appointment_cancelled') {
        const { data: appts } = await supabaseAdmin.from('appointments')
          .select('patient_id, updated_at, patients!inner(full_name, pipeline_stage)')
          .eq('tenant_id', auto.tenant_id)
          .eq('status', 'cancelled')
          .order('updated_at', { ascending: true })
          
        if (appts) {
          for (const a of appts) {
            if (a.patient_id && a.patients) {
              patientEvents.set(a.patient_id, {
                event_time: a.updated_at,
                full_name: (a.patients as any).full_name,
                pipeline_stage: (a.patients as any).pipeline_stage
              })
            }
          }
        }
      } else if (eventType === 'patient_created') {
        const { data: pats } = await supabaseAdmin.from('patients')
          .select('id, full_name, created_at, pipeline_stage')
          .eq('tenant_id', auto.tenant_id)
          .is('deleted_at', null)

        if (pats) {
          for (const p of pats) {
            patientEvents.set(p.id, {
              event_time: p.created_at,
              full_name: p.full_name,
              pipeline_stage: p.pipeline_stage
            })
          }
        }
      } else if (eventType === 'last_message') {
        const { data: msgs } = await supabaseAdmin.from('messages')
          .select('created_at, conversations!inner(patient_id, patients(full_name, pipeline_stage))')
          .eq('tenant_id', auto.tenant_id)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: true })

        if (msgs) {
          for (const m of msgs) {
            const conv = m.conversations as any
            if (conv && conv.patient_id && conv.patients) {
              patientEvents.set(conv.patient_id, {
                event_time: m.created_at,
                full_name: conv.patients.full_name,
                pipeline_stage: conv.patients.pipeline_stage
              })
            }
          }
        }
      } else if (eventType === 'stage_change') {
        const { data: pats } = await supabaseAdmin.from('patients')
          .select('id, full_name, updated_at, pipeline_stage')
          .eq('tenant_id', auto.tenant_id)
          .is('deleted_at', null)

        if (pats) {
          for (const p of pats) {
            if (tc.from_stage && p.pipeline_stage === tc.from_stage) {
              continue
            }
            patientEvents.set(p.id, {
              event_time: p.updated_at,
              full_name: p.full_name,
              pipeline_stage: p.pipeline_stage
            })
          }
        }
      }

      const duePatients = []
      const nowTime = Date.now()

      for (const [patient_id, data] of patientEvents.entries()) {
        const eventTime = new Date(data.event_time).getTime()
        const triggerAt = eventTime + (delayDays * 86400000) + (delayHours * 3600000)
        
        if (triggerAt < nowTime && triggerAt > nowTime - (48 * 3600000)) {
          let skip = false
          if (targetStage && data.pipeline_stage !== targetStage) skip = true
          if (excludeStages.includes(data.pipeline_stage)) skip = true

          if (!skip) {
            duePatients.push({ patient_id, trigger_at: triggerAt, event_time: data.event_time })
          }
        }
      }

      duePatients.sort((a, b) => a.trigger_at - b.trigger_at)
      total_patients_due += duePatients.length

      const patientsToProcess = duePatients.slice(0, 100)
      if (duePatients.length > 100) {
        console.log(`cron-automations: rate limited, processed 100 of ${duePatients.length}`)
      }

      for (const pt of patientsToProcess) {
        if (total_executed >= 500) {
          console.log(`cron-automations: global rate limit reached (500 executions).`)
          break
        }

        const twentyFourHoursBeforeTrigger = new Date(pt.trigger_at - 24 * 3600000).toISOString()
        
        const { data: logs } = await supabaseAdmin.from('automation_logs')
          .select('id')
          .eq('automation_id', auto.id)
          .eq('patient_id', pt.patient_id)
          .eq('status', 'success')
          .gte('created_at', twentyFourHoursBeforeTrigger)
          .limit(1)

        if (logs && logs.length > 0) {
          total_skipped++
          continue
        }

        console.log(`cron-automations: executing automation ${auto.id} for patient ${pt.patient_id} event_time=${pt.event_time} trigger_at=${new Date(pt.trigger_at).toISOString()}`)

        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)

          const res = await fetch(`${supabaseUrl}/functions/v1/process-automations`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              'apikey': serviceRoleKey
            },
            body: JSON.stringify({
              event_type: 'time_after_event',
              tenant_id: auto.tenant_id,
              patient_id: pt.patient_id,
              context: {
                automation_id: auto.id,
                trigger_event: eventType,
                delay_days: delayDays,
                event_time: pt.event_time
              }
            }),
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (res.ok) {
            total_executed++
          } else {
            total_failed++
          }
        } catch (e) {
          total_failed++
          console.log(`cron-automations fetch error:`, e)
        }
      }
    }

    const execution_time_ms = Date.now() - startTime

    console.log(`cron-automations SUMMARY: automations=${automations.length} due=${total_patients_due} executed=${total_executed} skipped=${total_skipped} failed=${total_failed} time=${execution_time_ms}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        automations_processed: automations.length,
        total_patients_due,
        total_executed,
        total_skipped,
        total_failed,
        execution_time_ms
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('cron-automations error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
