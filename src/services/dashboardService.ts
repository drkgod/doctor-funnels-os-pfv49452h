import { supabase } from '@/lib/supabase/client'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'

export async function fetchDashboardStats(tenant_id: string, period: 'week' | 'month') {
  const now = new Date()
  let dateFrom: Date
  let dateTo: Date
  let prevFrom: Date
  let prevTo: Date

  if (period === 'week') {
    dateFrom = startOfWeek(now, { weekStartsOn: 1 })
    dateTo = endOfWeek(now, { weekStartsOn: 1 })
    prevFrom = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    prevTo = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  } else {
    dateFrom = startOfMonth(now)
    dateTo = endOfMonth(now)
    prevFrom = startOfMonth(subMonths(now, 1))
    prevTo = endOfMonth(subMonths(now, 1))
  }

  const isoFrom = dateFrom.toISOString()
  const isoTo = dateTo.toISOString()
  const isoPrevFrom = prevFrom.toISOString()
  const isoPrevTo = prevTo.toISOString()

  const [{ count: newLeads }, appointments, prevAppointments, { count: conversions }] =
    await Promise.all([
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .gte('created_at', isoFrom)
        .lte('created_at', isoTo),

      supabase
        .from('appointments')
        .select('id, status')
        .eq('tenant_id', tenant_id)
        .gte('datetime_start', isoFrom)
        .lte('datetime_start', isoTo),

      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .gte('datetime_start', isoPrevFrom)
        .lte('datetime_start', isoPrevTo),

      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)
        .in('pipeline_stage', ['consultation', 'return', 'procedure'])
        .gte('updated_at', isoFrom)
        .lte('updated_at', isoTo),
    ])

  const apps = appointments.data || []
  const totalApps = apps.length
  const completedApps = apps.filter((a) => a.status === 'completed').length
  const noShows = apps.filter((a) => a.status === 'no_show').length
  const cancelled = apps.filter((a) => a.status === 'cancelled').length

  const leadsCount = newLeads || 0
  const convsCount = conversions || 0
  const convRate = leadsCount > 0 ? Number(((convsCount / leadsCount) * 100).toFixed(1)) : 0

  return {
    new_leads: leadsCount,
    total_appointments: totalApps,
    completed_appointments: completedApps,
    no_shows: noShows,
    cancelled: cancelled,
    conversion_rate: convRate,
    previous_appointments: prevAppointments.count || 0,
    period,
  }
}

export async function fetchRecentActivity(tenant_id: string, limit = 10) {
  const [patients, appointments, conversations] = await Promise.all([
    supabase
      .from('patients')
      .select('id, full_name, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('appointments')
      .select('id, patient_id, datetime_start, status, created_at, patients(full_name)')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('conversations')
      .select('id, phone_number, last_message_at, patient_id, patients(full_name)')
      .eq('tenant_id', tenant_id)
      .order('last_message_at', { ascending: false })
      .limit(5),
  ])

  const activities: any[] = []

  ;(patients.data || []).forEach((p) => {
    activities.push({
      id: `p_${p.id}`,
      entity_id: p.id,
      type: 'new_lead',
      description: `Novo lead: ${p.full_name}`,
      timestamp: p.created_at,
    })
  })

  ;(appointments.data || []).forEach((a) => {
    const patientName = (a.patients as any)?.full_name || 'Paciente'
    const dateStr = new Date(a.datetime_start).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    activities.push({
      id: `a_${a.id}`,
      entity_id: a.id,
      type: 'appointment',
      description: `Agendamento: ${patientName} - ${dateStr}`,
      timestamp: a.created_at,
    })
  })

  ;(conversations.data || []).forEach((c) => {
    const patientName = (c.patients as any)?.full_name || c.phone_number
    if (c.last_message_at) {
      activities.push({
        id: `c_${c.id}`,
        entity_id: c.id,
        type: 'message',
        description: `Mensagem de ${patientName}`,
        timestamp: c.last_message_at,
      })
    }
  })

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return activities.slice(0, limit)
}

export async function fetchUpcomingAppointments(tenant_id: string) {
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data } = await supabase
    .from('appointments')
    .select(
      'id, datetime_start, datetime_end, type, status, patient_id, patients(full_name, phone)',
    )
    .eq('tenant_id', tenant_id)
    .gte('datetime_start', now.toISOString())
    .lte('datetime_start', nextWeek.toISOString())
    .neq('status', 'cancelled')
    .order('datetime_start', { ascending: true })
    .limit(5)

  return (data || []).map((a) => ({
    id: a.id,
    patient_name: (a.patients as any)?.full_name || 'Desconhecido',
    patient_phone: (a.patients as any)?.phone || '',
    datetime_start: a.datetime_start,
    datetime_end: a.datetime_end,
    type: a.type,
    status: a.status,
  }))
}

export async function fetchPipelineSummary(tenant_id: string) {
  const stages = ['lead', 'contact', 'scheduled', 'consultation', 'return', 'procedure']

  const { data } = await supabase
    .from('patients')
    .select('pipeline_stage')
    .eq('tenant_id', tenant_id)
    .is('deleted_at', null)

  const counts: Record<string, number> = {}
  stages.forEach((s) => (counts[s] = 0))

  ;(data || []).forEach((p) => {
    if (counts[p.pipeline_stage] !== undefined) {
      counts[p.pipeline_stage]++
    }
  })

  return stages.map((stage) => ({
    stage,
    count: counts[stage],
  }))
}
