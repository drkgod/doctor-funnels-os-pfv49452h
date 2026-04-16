import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'

type RecordRow = Database['public']['Tables']['medical_records']['Row']
type SectionRow = Database['public']['Tables']['medical_record_sections']['Row']

export const medicalRecordService = {
  async fetchRecords(
    tenant_id: string,
    page: number = 1,
    per_page: number = 20,
    filters?: {
      status?: string
      doctor_id?: string
      patient_search?: string
      date_from?: string
      date_to?: string
    },
  ) {
    if (!tenant_id || tenant_id.trim() === '') {
      return {
        records: [],
        total: 0,
        page,
        total_pages: 0,
      }
    }

    let query = supabase
      .from('medical_records')
      .select(
        `
        *,
        patients!inner ( id, full_name, phone ),
        profiles!medical_records_doctor_id_fkey ( id, full_name, specialty )
      `,
        { count: 'exact' },
      )
      .eq('tenant_id', tenant_id)

    if (filters?.status && filters.status !== 'Todos') {
      query = query.eq('status', filters.status)
    }
    if (filters?.doctor_id) {
      query = query.eq('doctor_id', filters.doctor_id)
    }
    if (filters?.patient_search) {
      query = query.ilike('patients.full_name', `%${filters.patient_search}%`)
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to)
    }

    query = query.order('created_at', { ascending: false })

    const from = (page - 1) * per_page
    const to = from + per_page - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return {
      records:
        data?.map((record: any) => ({
          ...record,
          patient_name: record.patients?.full_name,
          patient_phone: record.patients?.phone,
          doctor_name: record.profiles?.full_name,
          doctor_specialty: record.profiles?.specialty,
        })) || [],
      total: count || 0,
      page,
      total_pages: count ? Math.ceil(count / per_page) : 1,
    }
  },

  async fetchRecordById(id: string) {
    const { data: record, error: recordError } = await supabase
      .from('medical_records')
      .select(`
        *,
        patients (*),
        profiles!medical_records_doctor_id_fkey (*)
      `)
      .eq('id', id)
      .single()

    if (recordError) throw recordError

    const { data: sections, error: sectionsError } = await supabase
      .from('medical_record_sections')
      .select('*')
      .eq('record_id', id)
      .order('section_type')

    if (sectionsError) throw sectionsError

    const { data: transcriptions, error: transcriptionsError } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('record_id', id)
      .order('created_at', { ascending: false })

    if (transcriptionsError) throw transcriptionsError

    const { data: body_maps, error: bodyMapsError } = await supabase
      .from('body_maps')
      .select('*')
      .eq('record_id', id)

    if (bodyMapsError) throw bodyMapsError

    const { data: prescriptions, error: prescriptionsError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('record_id', id)

    if (prescriptionsError) throw prescriptionsError

    const { data: reports, error: reportsError } = await supabase
      .from('medical_reports')
      .select('*')
      .eq('record_id', id)

    if (reportsError) throw reportsError

    return {
      record,
      patient: record.patients,
      doctor: record.profiles,
      sections: sections || [],
      transcriptions: transcriptions || [],
      body_maps: body_maps || [],
      prescriptions: prescriptions || [],
      reports: reports || [],
    }
  },

  async createRecord(
    tenant_id: string,
    patient_id: string,
    doctor_id: string,
    record_type: string = 'consultation',
    specialty: string = 'general',
    chief_complaint?: string,
    appointment_id?: string,
  ) {
    if (!tenant_id || tenant_id.trim() === '') throw new Error('Tenant ID is required.')
    if (!patient_id) throw new Error('Selecione um paciente.')

    const { data: record, error } = await supabase
      .from('medical_records')
      .insert({
        tenant_id,
        patient_id,
        doctor_id,
        record_type,
        specialty,
        chief_complaint,
        appointment_id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    const sectionsToInsert = [
      { record_id: record.id, section_type: 'subjective', content: '' },
      { record_id: record.id, section_type: 'objective', content: '' },
      { record_id: record.id, section_type: 'assessment', content: '', structured_data: {} },
      { record_id: record.id, section_type: 'plan', content: '', structured_data: {} },
      { record_id: record.id, section_type: 'vital_signs', content: '', structured_data: {} },
      { record_id: record.id, section_type: 'specialty_fields', content: '', structured_data: {} },
    ]

    const { data: sections, error: sectionsError } = await supabase
      .from('medical_record_sections')
      .insert(sectionsToInsert)
      .select()

    if (sectionsError) throw sectionsError

    return { ...record, sections }
  },

  async updateRecord(id: string, data: Partial<RecordRow>) {
    const { data: updated, error } = await supabase
      .from('medical_records')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return updated
  },

  async updateSection(
    section_id: string,
    content?: string,
    structured_data?: any,
    record_id?: string,
    section_type?: string,
  ) {
    if (section_id === 'new') {
      const { data: created, error } = await supabase
        .from('medical_record_sections')
        .insert({
          record_id,
          section_type,
          content: content || '',
          structured_data: structured_data || {},
        })
        .select()
        .single()
      if (error) throw error
      return created
    }

    const { data: section } = await supabase
      .from('medical_record_sections')
      .select('ai_generated')
      .eq('id', section_id)
      .single()

    const updateData: any = {}
    if (content !== undefined) updateData.content = content
    if (structured_data !== undefined) updateData.structured_data = structured_data
    if (section?.ai_generated) updateData.edited_after_ai = true

    const { data: updated, error } = await supabase
      .from('medical_record_sections')
      .update(updateData)
      .eq('id', section_id)
      .select()
      .single()

    if (error) throw error
    return updated
  },

  async completeRecord(id: string) {
    const { data: updated, error } = await supabase
      .from('medical_records')
      .update({
        status: 'review',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return updated
  },

  async deleteRecord(id: string) {
    const { error } = await supabase.from('medical_records').delete().eq('id', id)

    if (error) throw error
    return true
  },

  async applyAiSuggestions(record_id: string, ai_data: Record<string, any>) {
    const { data: section } = await supabase
      .from('medical_record_sections')
      .select('*')
      .eq('record_id', record_id)
      .eq('section_type', 'specialty_fields')
      .maybeSingle()

    if (!section) return

    const currentData = (section.structured_data as any) || {}
    let updated = false

    for (const [key, value] of Object.entries(ai_data)) {
      if (currentData[key] === undefined || currentData[key] === null || currentData[key] === '') {
        currentData[key] = value
        updated = true
      }
    }

    if (updated) {
      await supabase
        .from('medical_record_sections')
        .update({ structured_data: currentData })
        .eq('id', section.id)
    }
  },

  async fetchPatientHistory(patient_id: string) {
    const { data, error } = await supabase
      .from('medical_records')
      .select(`
        *,
        profiles!medical_records_doctor_id_fkey ( full_name )
      `)
      .eq('patient_id', patient_id)
      .in('status', ['completed', 'signed'])
      .order('created_at', { ascending: false })

    if (error) throw error

    return (
      data?.map((record: any) => ({
        ...record,
        doctor_name: record.profiles?.full_name,
      })) || []
    )
  },
}
