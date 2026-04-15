import { supabase } from '@/lib/supabase/client'
import { format, parseISO, differenceInMinutes, eachDayOfInterval } from 'date-fns'

export async function fetchFunnelReport(tenant_id: string, date_from: string, date_to: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('pipeline_stage')
    .eq('tenant_id', tenant_id)
    .gte('created_at', `${date_from}T00:00:00Z`)
    .lte('created_at', `${date_to}T23:59:59Z`)
    .is('deleted_at', null)
  if (error) throw error

  const stageOrder = ['lead', 'contact', 'scheduled', 'consultation', 'return', 'procedure']
  const counts = stageOrder.reduce(
    (acc, stage) => ({ ...acc, [stage]: 0 }),
    {} as Record<string, number>,
  )
  data.forEach((p) => {
    if (counts[p.pipeline_stage] !== undefined) counts[p.pipeline_stage]++
  })

  const stages = stageOrder.map((stage) => ({ stage, count: counts[stage] }))
  const conversions = []
  for (let i = 0; i < stages.length - 1; i++) {
    const current = stages[i].count
    const next = stages[i + 1].count
    conversions.push({
      from: stages[i].stage,
      to: stages[i + 1].stage,
      rate: current ? Number(((next / current) * 100).toFixed(1)) : 0,
    })
  }
  return { stages, conversions }
}

export async function fetchAppointmentReport(
  tenant_id: string,
  date_from: string,
  date_to: string,
) {
  const { data, error } = await supabase
    .from('appointments')
    .select('status, type, datetime_start')
    .eq('tenant_id', tenant_id)
    .gte('datetime_start', `${date_from}T00:00:00Z`)
    .lte('datetime_start', `${date_to}T23:59:59Z`)
  if (error) throw error

  const total_appointments = data.length
  const completed_count = data.filter((a) => a.status === 'completed').length
  const cancelled_count = data.filter((a) => a.status === 'cancelled').length
  const no_show_count = data.filter((a) => a.status === 'no_show').length
  const pending_count = data.filter((a) => a.status === 'pending').length
  const confirmed_count = data.filter((a) => a.status === 'confirmed').length

  const types = { consultation: 0, return: 0, procedure: 0 }
  data.forEach((a) => {
    if (types[a.type as keyof typeof types] !== undefined) types[a.type as keyof typeof types]++
  })

  const dow = [0, 0, 0, 0, 0, 0, 0]
  data.forEach((a) => dow[new Date(a.datetime_start).getDay()]++)

  return {
    total_appointments,
    completed_count,
    cancelled_count,
    no_show_count,
    pending_count,
    confirmed_count,
    completion_rate: total_appointments
      ? Number(((completed_count / total_appointments) * 100).toFixed(1))
      : 0,
    no_show_rate: total_appointments
      ? Number(((no_show_count / total_appointments) * 100).toFixed(1))
      : 0,
    cancellation_rate: total_appointments
      ? Number(((cancelled_count / total_appointments) * 100).toFixed(1))
      : 0,
    types,
    dow,
  }
}

export async function fetchWhatsAppReport(tenant_id: string, date_from: string, date_to: string) {
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('direction, sender_type, created_at, conversation_id')
    .eq('tenant_id', tenant_id)
    .gte('created_at', `${date_from}T00:00:00Z`)
    .lte('created_at', `${date_to}T23:59:59Z`)
    .order('created_at', { ascending: true })
  if (msgError) throw msgError

  const inbound_count = messages.filter((m) => m.direction === 'inbound').length
  const outbound_count = messages.filter((m) => m.direction === 'outbound').length
  const bot_messages = messages.filter((m) => m.sender_type === 'bot').length
  let totalDiff = 0
  let responsePairs = 0
  const convMessages = messages.reduce(
    (acc, m) => {
      ;(acc[m.conversation_id] = acc[m.conversation_id] || []).push(m)
      return acc
    },
    {} as Record<string, any[]>,
  )

  for (const convId in convMessages) {
    const msgs = convMessages[convId]
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].direction === 'inbound') {
        const nextOutbound = msgs.slice(i + 1).find((m) => m.direction === 'outbound')
        if (nextOutbound) {
          const diff = differenceInMinutes(
            new Date(nextOutbound.created_at),
            new Date(msgs[i].created_at),
          )
          if (diff >= 0) {
            totalDiff += diff
            responsePairs++
          }
        }
      }
    }
  }

  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('status')
    .eq('tenant_id', tenant_id)
    .gte('created_at', `${date_from}T00:00:00Z`)
    .lte('created_at', `${date_to}T23:59:59Z`)
  if (convError) throw convError

  return {
    total_messages: messages.length,
    inbound_count,
    outbound_count,
    bot_messages,
    human_messages: messages.filter((m) => m.sender_type === 'human').length,
    patient_messages: messages.filter((m) => m.sender_type === 'patient').length,
    bot_percentage: outbound_count ? Number(((bot_messages / outbound_count) * 100).toFixed(1)) : 0,
    average_response_time: responsePairs > 0 ? Math.round(totalDiff / responsePairs) : null,
    total_conversations: convs.length,
    active_conversations: convs.filter((c) => c.status === 'active').length,
    waiting_conversations: convs.filter((c) => c.status === 'waiting').length,
  }
}

export async function fetchEmailReport(tenant_id: string, date_from: string, date_to: string) {
  const { data: campaigns, error: campError } = await supabase
    .from('email_campaigns')
    .select('status, sent_count, opened_count, clicked_count, bounced_count')
    .eq('tenant_id', tenant_id)
    .gte('created_at', `${date_from}T00:00:00Z`)
    .lte('created_at', `${date_to}T23:59:59Z`)
  if (campError) throw campError

  const total_sent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0)
  const total_opened = campaigns.reduce((s, c) => s + (c.opened_count || 0), 0)
  const total_clicked = campaigns.reduce((s, c) => s + (c.clicked_count || 0), 0)
  const total_bounced = campaigns.reduce((s, c) => s + (c.bounced_count || 0), 0)

  const { data: usage } = await supabase
    .from('tenant_email_usage')
    .select('emails_sent, month')
    .eq('tenant_id', tenant_id)
    .gte('month', date_from.substring(0, 10))
    .lte('month', date_to.substring(0, 10))

  return {
    total_campaigns: campaigns.length,
    sent_campaigns: campaigns.filter((c) => c.status === 'sent').length,
    total_sent,
    total_opened,
    total_clicked,
    total_bounced,
    open_rate: total_sent ? Number(((total_opened / total_sent) * 100).toFixed(1)) : 0,
    click_rate: total_sent ? Number(((total_clicked / total_sent) * 100).toFixed(1)) : 0,
    bounce_rate: total_sent ? Number(((total_bounced / total_sent) * 100).toFixed(1)) : 0,
    usage: usage || [],
  }
}

export async function fetchLeadSourceReport(tenant_id: string, date_from: string, date_to: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('source')
    .eq('tenant_id', tenant_id)
    .gte('created_at', `${date_from}T00:00:00Z`)
    .lte('created_at', `${date_to}T23:59:59Z`)
    .is('deleted_at', null)
  if (error) throw error
  const counts: Record<string, number> = {}
  data.forEach((p) => {
    counts[p.source] = (counts[p.source] || 0) + 1
  })
  return Object.entries(counts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
}

export async function fetchDailyTrend(
  tenant_id: string,
  date_from: string,
  date_to: string,
  metric: 'leads' | 'appointments' | 'messages' | 'conversations',
) {
  let table = ''
  let dateField = 'created_at'
  if (metric === 'leads') table = 'patients'
  else if (metric === 'appointments') {
    table = 'appointments'
    dateField = 'datetime_start'
  } else if (metric === 'messages') table = 'messages'
  else if (metric === 'conversations') table = 'conversations'

  const { data, error } = await supabase
    .from(table as any)
    .select(dateField)
    .eq('tenant_id', tenant_id)
    .gte(dateField, `${date_from}T00:00:00Z`)
    .lte(dateField, `${date_to}T23:59:59Z`)
  if (error) throw error

  const counts: Record<string, number> = {}
  try {
    eachDayOfInterval({ start: parseISO(date_from), end: parseISO(date_to) }).forEach(
      (d) => (counts[format(d, 'yyyy-MM-dd')] = 0),
    )
  } catch (e) {}

  data.forEach((row) => {
    try {
      const d = format(parseISO(row[dateField]), 'yyyy-MM-dd')
      if (counts[d] !== undefined) counts[d]++
    } catch (e) {}
  })
  return Object.entries(counts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function exportReportCSV(report_name: string, data: any[]) {
  if (!data || !data.length) return false
  const mapHeader = (key: string) =>
    ({
      stage: 'Estagio',
      count: 'Quantidade',
      rate: 'Taxa',
      source: 'Origem',
      date: 'Data',
      status: 'Status',
      type: 'Tipo',
      datetime_start: 'Data',
    })[key] || key
  const headers = Object.keys(data[0])
  const csvRows = data.map((row) =>
    headers
      .map((h) => {
        let val = row[h]
        if (val === null || val === undefined) val = ''
        if (typeof val === 'number') val = val.toString().replace('.', ',')
        else if (['date', 'created_at', 'datetime_start'].includes(h)) {
          try {
            val = format(parseISO(val), 'dd/MM/yyyy')
          } catch (e) {}
        }
        return `"${val}"`
      })
      .join(','),
  )
  const blob = new Blob([[headers.map(mapHeader).join(','), ...csvRows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', `${report_name}_${format(new Date(), 'yyyy-MM-dd')}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}
