import { supabase } from '@/lib/supabase/client'

export const automationService = {
  async getAutomationStats(tenant_id: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()

    const [todayLogs, last30dTotal, last30dSuccess, activeAutos, lastLog] = await Promise.all([
      supabase
        .from('automation_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .gte('created_at', todayStr),
      supabase
        .from('automation_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .gte('created_at', thirtyDaysAgoStr),
      supabase
        .from('automation_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .eq('status', 'success')
        .gte('created_at', thirtyDaysAgoStr),
      supabase
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .eq('is_active', true),
      supabase
        .from('automation_logs')
        .select('created_at')
        .eq('tenant_id', tenant_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    let success_rate_30d = null
    if (last30dTotal.count && last30dTotal.count > 0) {
      success_rate_30d = ((last30dSuccess.count || 0) / last30dTotal.count) * 100
    }

    return {
      executions_today: todayLogs.count || 0,
      success_rate_30d,
      active_count: activeAutos.count || 0,
      last_execution: lastLog.data?.created_at || null,
    }
  },

  async activateTemplate(tenant_id: string, data: any) {
    return this.createAutomation(tenant_id, { ...data, is_active: true })
  },

  async fetchAutomations(tenant_id: string) {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async fetchAutomationById(id: string) {
    const { data: automation, error: autoError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single()
    if (autoError) throw autoError

    const { data: logs, error: logsError } = await supabase
      .from('automation_logs')
      .select('*, patients(full_name)')
      .eq('automation_id', id)
      .order('executed_at', { ascending: false })
      .limit(20)
    if (logsError) throw logsError

    return { automation, logs }
  },

  async createAutomation(tenant_id: string, data: any) {
    if (!data.name) throw new Error('Nome é obrigatório')

    const trigger_config =
      data.trigger_type === 'stage_change'
        ? {
            from_stage:
              data.trigger_config.from_stage === 'any' ? null : data.trigger_config.from_stage,
            target_stage: data.trigger_config.target_stage,
          }
        : data.trigger_type === 'time_after_event'
          ? {
              days_after: Number(data.trigger_config.days_after),
              event_type: data.trigger_config.event_type,
            }
          : {}

    const action_config =
      data.action_type === 'send_whatsapp'
        ? { message: data.action_config.message }
        : data.action_type === 'send_email'
          ? {
              template_id: data.action_config.template_id,
              template_name: data.action_config.template_name,
            }
          : data.action_type === 'move_pipeline'
            ? { target_stage: data.action_config.target_stage }
            : data.action_type === 'create_task'
              ? {
                  task_name: data.action_config.task_name,
                  task_description: data.action_config.task_description,
                }
              : {}

    const { data: created, error } = await supabase
      .from('automations')
      .insert({
        tenant_id,
        name: data.name,
        trigger_type: data.trigger_type,
        trigger_config,
        action_type: data.action_type,
        action_config,
        is_active: data.is_active ?? false,
      })
      .select()
      .single()
    if (error) throw error
    return created
  },

  async updateAutomation(id: string, data: any) {
    if (data.name !== undefined && !data.name) throw new Error('Nome é obrigatório')

    const payload: any = { ...data }

    if (data.trigger_type) {
      payload.trigger_config =
        data.trigger_type === 'stage_change'
          ? {
              from_stage:
                data.trigger_config.from_stage === 'any' ? null : data.trigger_config.from_stage,
              target_stage: data.trigger_config.target_stage,
            }
          : data.trigger_type === 'time_after_event'
            ? {
                days_after: Number(data.trigger_config.days_after),
                event_type: data.trigger_config.event_type,
              }
            : {}
    }

    if (data.action_type) {
      payload.action_config =
        data.action_type === 'send_whatsapp'
          ? { message: data.action_config.message }
          : data.action_type === 'send_email'
            ? {
                template_id: data.action_config.template_id,
                template_name: data.action_config.template_name,
              }
            : data.action_type === 'move_pipeline'
              ? { target_stage: data.action_config.target_stage }
              : data.action_type === 'create_task'
                ? {
                    task_name: data.action_config.task_name,
                    task_description: data.action_config.task_description,
                  }
                : {}
    }

    const { data: updated, error } = await supabase
      .from('automations')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return updated
  },

  async deleteAutomation(id: string) {
    const { error } = await supabase.from('automations').delete().eq('id', id)
    if (error) throw error
  },

  async toggleAutomation(id: string, is_active: boolean) {
    const { data, error } = await supabase
      .from('automations')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async fetchAutomationLogs(automation_id: string, page = 1, per_page = 20) {
    const start = (page - 1) * per_page
    const end = start + per_page - 1

    const { data, error, count } = await supabase
      .from('automation_logs')
      .select('*, patients(full_name)', { count: 'exact' })
      .eq('automation_id', automation_id)
      .order('executed_at', { ascending: false })
      .range(start, end)

    if (error) throw error

    return {
      logs: data,
      total: count || 0,
      current_page: page,
      total_pages: Math.ceil((count || 0) / per_page),
    }
  },

  async executeManualAutomation(automation_id: string, tenant_id: string, patient_ids: string[]) {
    if (patient_ids.length === 0)
      return { total: 0, success_count: 0, failure_count: 0, results: [] }

    let success_count = 0
    let failure_count = 0
    const results = []

    for (const patient_id of patient_ids) {
      try {
        const { data, error } = await supabase.functions.invoke('process-automations', {
          body: {
            event_type: 'manual',
            tenant_id,
            patient_id,
            context: { automation_id },
          },
        })

        if (error) {
          failure_count++
          results.push({ patient_id, error: error.message })
        } else {
          if (data && data.results && data.results.length > 0) {
            const firstRes = data.results[0]
            if (firstRes.status === 'success') success_count++
            else failure_count++
            results.push({ patient_id, ...firstRes })
          } else {
            success_count++
          }
        }
      } catch (err: any) {
        failure_count++
        results.push({ patient_id, error: err.message })
      }
    }

    return { total: patient_ids.length, success_count, failure_count, results }
  },
}
