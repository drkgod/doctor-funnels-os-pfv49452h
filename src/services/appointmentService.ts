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
}

export const appointmentService = {
  async fetchAppointments(tenantId: string, from: string, to: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients(full_name)')
      .eq('tenant_id', tenantId)
      .gte('datetime_start', from)
      .lte('datetime_start', to)
      .order('datetime_start', { ascending: true })

    if (error) throw error

    return (data || []).map((item: any) => ({
      ...item,
      patient_name: item.patients?.full_name,
    }))
  },

  async createAppointment(
    tenantId: string,
    data: {
      patient_id: string
      doctor_id?: string | null
      datetime_start: string
      datetime_end: string
      type: string
      status?: string
      notes?: string | null
    },
  ) {
    const payload = {
      tenant_id: tenantId,
      patient_id: data.patient_id,
      doctor_id: data.doctor_id || null,
      datetime_start: data.datetime_start,
      datetime_end: data.datetime_end,
      type: data.type,
      status: data.status || 'pending',
      notes: data.notes || null,
    }

    const { data: created, error } = await supabase
      .from('appointments')
      .insert(payload)
      .select('*, patients(full_name)')
      .single()

    if (error) throw error

    const appointment = {
      ...created,
      patient_name: created.patients?.full_name,
    } as Appointment

    try {
      if (appointment.id) {
        await appointmentService.syncAppointmentToGoogleCalendar(tenantId, {
          patient_name: appointment.patient_name || 'Paciente',
          datetime_start: appointment.datetime_start,
          datetime_end: appointment.datetime_end,
          notes: appointment.notes || undefined,
          appointmentId: appointment.id,
        })
      }
    } catch (e) {
      // silent
    }

    return appointment
  },

  async updateAppointment(appointmentId: string, data: Partial<Appointment>) {
    const { data: original, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (fetchError) throw fetchError

    const { patient_name, patients, ...updateData } = data as any

    const { data: updated, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .select('*, patients(full_name)')
      .single()

    if (error) throw error

    try {
      if (original.google_event_id && (data.datetime_start || data.datetime_end)) {
        await appointmentService.updateGoogleCalendarEvent(original.google_event_id, {
          start_datetime: data.datetime_start || original.datetime_start,
          end_datetime: data.datetime_end || original.datetime_end,
          description: data.notes !== undefined ? data.notes : original.notes,
        })
      }
    } catch (e) {
      // silent
    }

    return {
      ...updated,
      patient_name: updated.patients?.full_name,
    } as Appointment
  },

  async completeAppointment(appointmentId: string) {
    const { data: original } = await supabase
      .from('appointments')
      .select('tenant_id, patient_id')
      .eq('id', appointmentId)
      .single()
    const updated = await appointmentService.updateAppointment(appointmentId, {
      status: 'completed',
    })

    if (original) {
      console.log(
        `AUTOMATION_TRIGGER: event=appointment_completed tenant=${original.tenant_id.substring(0, 8)} patient=${original.patient_id.substring(0, 8)}`,
      )
      supabase.functions
        .invoke('process-automations', {
          body: {
            event_type: 'appointment_completed',
            tenant_id: original.tenant_id,
            patient_id: original.patient_id,
            context: { appointment_id: appointmentId },
          },
        })
        .catch((e) => console.log('Automation trigger error:', e))
    }

    return updated
  },

  async markNoShow(appointmentId: string) {
    return appointmentService.updateAppointment(appointmentId, { status: 'no_show' })
  },

  async cancelAppointment(appointmentId: string) {
    const { data: original, error: fetchError } = await supabase
      .from('appointments')
      .select('google_event_id')
      .eq('id', appointmentId)
      .single()

    if (fetchError) throw fetchError

    const updated = await appointmentService.updateAppointment(appointmentId, {
      status: 'cancelled',
    })

    try {
      if (original.google_event_id) {
        await appointmentService.deleteGoogleCalendarEvent(original.google_event_id)
      }
    } catch (e) {
      // silent
    }

    return updated
  },

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
      const { data: statusData, error: statusError } = await supabase.functions.invoke(
        'google-calendar-auth',
        {
          body: { action: 'check_status' },
        },
      )

      if (statusError || !statusData?.connected) {
        return // Silent return if not connected
      }

      const { data: syncData, error: syncError } = await supabase.functions.invoke(
        'google-calendar-sync',
        {
          body: {
            action: 'create_event',
            event_data: {
              summary: `Consulta - ${appointmentData.patient_name}`,
              start_datetime: appointmentData.datetime_start,
              end_datetime: appointmentData.datetime_end,
              description: appointmentData.notes || '',
            },
          },
        },
      )

      if (syncError || !syncData?.id) {
        toast({
          variant: 'destructive',
          description: 'Agendamento criado, mas nao foi possivel sincronizar com Google Calendar.',
        })
        return
      }

      // Update appointment with google_event_id
      await supabase
        .from('appointments')
        .update({ google_event_id: syncData.id })
        .eq('id', appointmentData.appointmentId)
    } catch (e) {
      toast({
        variant: 'destructive',
        description: 'Agendamento criado, mas nao foi possivel sincronizar com Google Calendar.',
      })
    }
  },

  async updateGoogleCalendarEvent(googleEventId: string, eventData: any) {
    try {
      const { data: statusData, error: statusError } = await supabase.functions.invoke(
        'google-calendar-auth',
        {
          body: { action: 'check_status' },
        },
      )

      if (statusError || !statusData?.connected) return

      const { error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'update_event', event_id: googleEventId, event_data: eventData },
      })

      if (syncError) {
        toast({
          variant: 'destructive',
          description:
            'Agendamento atualizado, mas nao foi possivel sincronizar com Google Calendar.',
        })
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        description:
          'Agendamento atualizado, mas nao foi possivel sincronizar com Google Calendar.',
      })
    }
  },

  async deleteGoogleCalendarEvent(googleEventId: string) {
    try {
      const { data: statusData, error: statusError } = await supabase.functions.invoke(
        'google-calendar-auth',
        {
          body: { action: 'check_status' },
        },
      )

      if (statusError || !statusData?.connected) return

      const { error: syncError } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'delete_event', event_id: googleEventId },
      })

      if (syncError) {
        toast({
          variant: 'destructive',
          description: 'Agendamento removido, mas nao foi possivel remover do Google Calendar.',
        })
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        description: 'Agendamento removido, mas nao foi possivel remover do Google Calendar.',
      })
    }
  },
}
