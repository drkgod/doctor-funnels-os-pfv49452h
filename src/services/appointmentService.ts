import { supabase } from '@/lib/supabase/client'

export type Appointment = {
  id: string
  tenant_id: string
  patient_id: string
  doctor_id: string | null
  datetime_start: string
  datetime_end: string
  type: string
  status: string
  google_event_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  patient_name?: string
  patient_phone?: string
}

export const appointmentService = {
  async fetchAppointments(tenant_id: string, date_from: string, date_to: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patients!appointments_patient_id_fkey (
          full_name,
          phone
        )
      `)
      .eq('tenant_id', tenant_id)
      .gte('datetime_start', date_from)
      .lte('datetime_start', date_to)
      .neq('status', 'cancelled')
      .order('datetime_start', { ascending: true })

    if (error) throw error
    return (data || []).map((a: any) => ({
      ...a,
      patient_name: a.patients?.full_name,
      patient_phone: a.patients?.phone,
    })) as Appointment[]
  },

  async fetchAppointmentsByDate(tenant_id: string, date: string) {
    const date_from = `${date}T00:00:00.000Z`
    const date_to = `${date}T23:59:59.999Z`
    return this.fetchAppointments(tenant_id, date_from, date_to)
  },

  async fetchAppointmentById(id: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patients!appointments_patient_id_fkey (
          full_name,
          phone
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return {
      ...data,
      patient_name: data.patients?.full_name,
      patient_phone: data.patients?.phone,
    } as Appointment
  },

  async createAppointment(tenant_id: string, data: any) {
    if (new Date(data.datetime_start) < new Date()) {
      throw new Error('Data deve ser futura')
    }
    if (new Date(data.datetime_end) <= new Date(data.datetime_start)) {
      throw new Error('Horario final deve ser apos o inicio')
    }

    const { data: conflicts, error: conflictError } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', tenant_id)
      .neq('status', 'cancelled')
      .lt('datetime_start', data.datetime_end)
      .gt('datetime_end', data.datetime_start)

    if (conflictError) throw conflictError
    if (conflicts && conflicts.length > 0) {
      throw new Error('Ja existe um agendamento neste horario.')
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        tenant_id,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id || null,
        datetime_start: data.datetime_start,
        datetime_end: data.datetime_end,
        type: data.type,
        status: data.status || 'pending',
        notes: data.notes || null,
      })
      .select()
      .single()

    if (error) throw error
    return appointment as Appointment
  },

  async updateAppointment(id: string, data: any) {
    if (data.datetime_start && data.datetime_end) {
      const current = await this.fetchAppointmentById(id)
      const { data: conflicts, error: conflictError } = await supabase
        .from('appointments')
        .select('id')
        .eq('tenant_id', current.tenant_id)
        .neq('id', id)
        .neq('status', 'cancelled')
        .lt('datetime_start', data.datetime_end)
        .gt('datetime_end', data.datetime_start)

      if (conflictError) throw conflictError
      if (conflicts && conflicts.length > 0) {
        throw new Error('Ja existe um agendamento neste horario.')
      }
    }

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return appointment as Appointment
  },

  async cancelAppointment(id: string) {
    return this.updateAppointment(id, { status: 'cancelled' })
  },

  async markNoShow(id: string) {
    return this.updateAppointment(id, { status: 'no_show' })
  },

  async completeAppointment(id: string) {
    return this.updateAppointment(id, { status: 'completed' })
  },

  async fetchTodaysAppointments(tenant_id: string) {
    const today = new Date().toISOString().split('T')[0]
    return this.fetchAppointmentsByDate(tenant_id, today)
  },

  async fetchUpcomingAppointments(tenant_id: string, limit: number = 5) {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patients!appointments_patient_id_fkey (
          full_name,
          phone
        )
      `)
      .eq('tenant_id', tenant_id)
      .gt('datetime_start', now)
      .neq('status', 'cancelled')
      .order('datetime_start', { ascending: true })
      .limit(limit)

    if (error) throw error
    return (data || []).map((a: any) => ({
      ...a,
      patient_name: a.patients?.full_name,
      patient_phone: a.patients?.phone,
    })) as Appointment[]
  },
}
