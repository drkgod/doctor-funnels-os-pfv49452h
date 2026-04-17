import { supabase } from '@/lib/supabase/client'
import { format, differenceInHours, differenceInDays, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export async function fetchAppointmentAnalytics(
  tenantId: string,
  dateRange: { from: string; to: string },
) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status, type, datetime_start')
    .eq('tenant_id', tenantId)
    .gte('datetime_start', dateRange.from)
    .lte('datetime_start', dateRange.to + 'T23:59:59.999Z')

  if (error) throw error

  const total = data.length
  const by_status = data.reduce((acc: any, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1
    return acc
  }, {})

  const by_type = data.reduce((acc: any, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + 1
    return acc
  }, {})

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const weekdayCounts = Array(7).fill(0)
  const hourCounts = Array(24).fill(0)

  data.forEach((app) => {
    const d = new Date(app.datetime_start)
    weekdayCounts[d.getDay()]++
    hourCounts[d.getHours()]++
  })

  const by_weekday = weekdays.map((name, i) => ({ name, count: weekdayCounts[i] }))
  const by_hour = hourCounts.map((count, hour) => ({ hour: `${hour}h`, count }))

  const daysDiff = Math.max(
    1,
    differenceInDays(new Date(dateRange.to), new Date(dateRange.from)) + 1,
  )
  const average_per_day = total / daysDiff
  const no_show_rate = total ? ((by_status['no_show'] || 0) / total) * 100 : 0
  const cancellation_rate = total ? ((by_status['cancelled'] || 0) / total) * 100 : 0

  const by_type_detail = data.reduce((acc: any, curr) => {
    if (!acc[curr.type]) acc[curr.type] = { total: 0, completed: 0, no_show: 0 }
    acc[curr.type].total++
    if (curr.status === 'completed') acc[curr.type].completed++
    if (curr.status === 'no_show') acc[curr.type].no_show++
    return acc
  }, {})

  const type_details = Object.entries(by_type_detail)
    .map(([type, stats]: any) => ({
      type,
      total: stats.total,
      completed: stats.completed,
      no_show: stats.no_show,
      no_show_rate: stats.total ? ((stats.no_show / stats.total) * 100).toFixed(2) : '0.00',
    }))
    .sort((a: any, b: any) => b.total - a.total)

  return {
    total_appointments: total,
    by_status,
    by_type,
    by_weekday,
    by_hour,
    average_per_day,
    no_show_rate,
    cancellation_rate,
    type_details,
  }
}

export async function fetchPatientAnalytics(
  tenantId: string,
  dateRange: { from: string; to: string },
) {
  const { count: total_patients } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const { data: newPatients } = await supabase
    .from('patients')
    .select('id, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', dateRange.from)
    .lte('created_at', dateRange.to + 'T23:59:59.999Z')

  const twelveMonthsAgo = subMonths(new Date(), 12).toISOString()
  const { data: allRecentPatients } = await supabase
    .from('patients')
    .select('id, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', twelveMonthsAgo)

  const by_month = []
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(new Date(), i)
    const monthName = format(d, 'MMM', { locale: ptBR })
    const monthIndex = d.getMonth()
    const year = d.getFullYear()
    const count =
      allRecentPatients?.filter((p) => {
        const pd = new Date(p.created_at)
        return pd.getMonth() === monthIndex && pd.getFullYear() === year
      }).length || 0
    by_month.push({ month: monthName, count })
  }

  const { data: periodAppointments } = await supabase
    .from('appointments')
    .select('patient_id')
    .eq('tenant_id', tenantId)
    .gte('datetime_start', dateRange.from)
    .lte('datetime_start', dateRange.to + 'T23:59:59.999Z')

  const patientApptCounts =
    periodAppointments?.reduce((acc: any, curr) => {
      acc[curr.patient_id] = (acc[curr.patient_id] || 0) + 1
      return acc
    }, {}) || {}

  let returning_patients = 0
  let total_with_appt = 0
  for (const pid in patientApptCounts) {
    total_with_appt++
    if (patientApptCounts[pid] > 1) returning_patients++
  }

  const retention_rate = total_with_appt ? (returning_patients / total_with_appt) * 100 : 0

  return {
    total_patients: total_patients || 0,
    new_in_period: newPatients?.length || 0,
    by_month,
    returning_patients,
    retention_rate,
  }
}

export async function fetchRecordAnalytics(
  tenantId: string,
  dateRange: { from: string; to: string },
) {
  const { data: records, error } = await supabase
    .from('medical_records')
    .select('id, status, record_type, created_at, signed_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', dateRange.from)
    .lte('created_at', dateRange.to + 'T23:59:59.999Z')

  if (error) throw error

  const total_records = records.length
  const by_status = records.reduce((acc: any, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1
    return acc
  }, {})
  const by_type = records.reduce((acc: any, curr) => {
    acc[curr.record_type] = (acc[curr.record_type] || 0) + 1
    return acc
  }, {})

  const signed_rate = total_records ? ((by_status['signed'] || 0) / total_records) * 100 : 0

  let completion_time_sum = 0
  let completion_time_count = 0

  records.forEach((r) => {
    if (r.status === 'signed' && r.signed_at && r.created_at) {
      const diff = differenceInHours(new Date(r.signed_at), new Date(r.created_at))
      if (diff >= 0) {
        completion_time_sum += diff
        completion_time_count++
      }
    }
  })
  const average_completion_time = completion_time_count
    ? completion_time_sum / completion_time_count
    : 0

  const recordIds = records.map((r) => r.id)
  let ai_assisted = 0
  if (recordIds.length > 0) {
    const { data: sections } = await supabase
      .from('medical_record_sections')
      .select('record_id, ai_generated')
      .in('record_id', recordIds)
      .eq('ai_generated', true)

    const uniqueRecordsWithAi = new Set(sections?.map((s) => s.record_id))
    ai_assisted = uniqueRecordsWithAi.size
  }

  const ai_assisted_rate = total_records ? (ai_assisted / total_records) * 100 : 0

  return {
    total_records,
    by_status,
    by_type,
    signed_rate,
    ai_assisted,
    ai_assisted_rate,
    average_completion_time,
  }
}

export async function fetchTranscriptionAnalytics(
  tenantId: string,
  dateRange: { from: string; to: string },
) {
  const { data, error } = await supabase
    .from('transcriptions')
    .select('id, status, duration_seconds')
    .eq('tenant_id', tenantId)
    .gte('created_at', dateRange.from)
    .lte('created_at', dateRange.to + 'T23:59:59.999Z')

  if (error) throw error

  const total = data.length
  let completed = 0
  let failed = 0
  let total_duration = 0

  data.forEach((t) => {
    if (t.status === 'completed') completed++
    if (t.status === 'failed') failed++
    total_duration += t.duration_seconds || 0
  })

  const average_duration = completed ? total_duration / completed / 60 : 0
  const total_duration_hours = Math.floor(total_duration / 3600)
  const total_duration_minutes = Math.floor((total_duration % 3600) / 60)

  return {
    total,
    completed,
    failed,
    average_duration,
    total_duration,
    total_duration_hours,
    total_duration_minutes,
  }
}

export function exportReportCSV(reportType: string, data: any) {
  let csv = ''
  if (reportType === 'appointments') {
    csv += 'Métrica,Valor\n'
    csv += `Total de Consultas,${data.total_appointments}\n`
    csv += `Realizadas,${data.by_status['completed'] || 0}\n`
    csv += `Taxa de Faltas,"${data.no_show_rate.toFixed(2).replace('.', ',')}%"\n`
    csv += `Taxa de Cancelamento,"${data.cancellation_rate.toFixed(2).replace('.', ',')}%"\n`
  } else if (reportType === 'patients') {
    csv += 'Métrica,Valor\n'
    csv += `Total de Pacientes,${data.total_patients}\n`
    csv += `Novos no Período,${data.new_in_period}\n`
    csv += `Taxa de Retorno,"${data.retention_rate.toFixed(2).replace('.', ',')}%"\n`
  } else if (reportType === 'records') {
    csv += 'Métrica,Valor\n'
    csv += `Total de Prontuários,${data.total_records}\n`
    csv += `Assinados,${data.by_status['signed'] || 0}\n`
    csv += `Taxa de Assinatura,"${data.signed_rate.toFixed(2).replace('.', ',')}%"\n`
    csv += `Assistidos por IA,${data.ai_assisted}\n`
  } else if (reportType === 'transcriptions') {
    csv += 'Métrica,Valor\n'
    csv += `Total de Transcrições,${data.total}\n`
    csv += `Concluídas,${data.completed}\n`
    csv += `Falhadas,${data.failed}\n`
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${reportType}-relatorio-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
