import { supabase } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'

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
  async syncAppointmentToGoogleCalendar(
    tenantId: string,
    appointmentData: {
      patient_name: string
      datetime_start: string
      datetime_end: string
      notes?: string
      appointmentId: string
    },
  ) {
    try {
      const { data: statusData } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'check_status' },
      })
      if (!statusData?.connected) return

      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'create_event',
          event_data: {
            summary: `Consulta - ${appointmentData.patient_name}`,
            start_datetime: appointmentData.datetime_start,
            end_datetime: appointmentData.datetime_end,
            description: appointmentData.notes || '',
          },
        },
      })

      if (error || !data?.id) {
        toast({
          title: 'Aviso',
          description: 'Agendamento criado, mas nao foi possivel sincronizar com Google Calendar.',
          variant: 'destructive',
        })
        return
      }

      await supabase
        .from('appointments')
        .update({ google_event_id: data.id })
        .eq('id', appointmentData.appointmentId)
    } catch (e) {
      toast({
        title: 'Aviso',
        description: 'Agendamento criado, mas nao foi possivel sincronizar com Google Calendar.',
        variant: 'destructive',
      })
    }
  },

  async updateGoogleCalendarEvent(googleEventId: string, eventData: any) {
    try {
      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'update_event',
          event_id: googleEventId,
          event_data: eventData,
        },
      })
      if (error) throw error
    } catch (e) {
      toast({
        title: 'Aviso',
        description:
          'Agendamento atualizado, mas nao foi possivel sincronizar com Google Calendar.',
        variant: 'destructive',
      })
    }
  },

  async deleteGoogleCalendarEvent(googleEventId: string) {
    try {
      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'delete_event',
          event_id: googleEventId,
        },
      })
      if (error) throw error
    } catch (e) {
      toast({
        title: 'Aviso',
        description: 'Agendamento cancelado, mas nao foi possivel remover do Google Calendar.',
        variant: 'destructive',
      })
    }
  },

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

    try {
      const { data: patient } = await supabase
        .from('patients')
        .select('full_name')
        .eq('id', data.patient_id)
        .single()

      this.syncAppointmentToGoogleCalendar(tenant_id, {
        patient_name: patient?.full_name || 'Paciente',
        datetime_start: data.datetime_start,
        datetime_end: data.datetime_end,
        notes: data.notes || '',
        appointmentId: appointment.id,
      })
    } catch (err) {
      console.error(err)
    }

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

    const current = await this.fetchAppointmentById(id)

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (current.google_event_id) {
      const updateData: any = {}
      if (data.datetime_start) updateData.start_datetime = data.datetime_start
      if (data.datetime_end) updateData.end_datetime = data.datetime_end
      if (data.notes !== undefined) updateData.description = data.notes
      if (data.status === 'cancelled') {
        this.deleteGoogleCalendarEvent(current.google_event_id)
      } else if (Object.keys(updateData).length > 0) {
        this.updateGoogleCalendarEvent(current.google_event_id, updateData)
      }
    }

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
