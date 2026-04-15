import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

export type Patient = Database['public']['Tables']['patients']['Row']

const sanitizeEmptyStrings = (obj: any) => {
  const newObj = { ...obj }
  for (const key in newObj) {
    if (newObj[key] === '' && key !== 'full_name') {
      newObj[key] = null
    }
  }
  return newObj
}

export const patientService = {
  async fetchPatients(
    tenant_id: string,
    filters?: {
      search?: string
      pipeline_stage?: string
      source?: string
      assigned_to?: string
      tags?: string[]
    },
  ) {
    let q = supabase
      .from('patients')
      .select('*, assigned:profiles(full_name)')
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null)
    if (filters?.search)
      q = q.or(
        `full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
      )
    if (filters?.pipeline_stage) q = q.eq('pipeline_stage', filters.pipeline_stage)
    if (filters?.source && filters.source !== 'Todas as origens') q = q.eq('source', filters.source)
    if (filters?.assigned_to) q = q.eq('assigned_to', filters.assigned_to)
    if (filters?.tags && filters.tags.length > 0) q = q.contains('tags', filters.tags)
    const { data, error } = await q.order('updated_at', { ascending: false })
    if (error) throw error
    return data as any[]
  },

  async fetchPatientById(id: string) {
    const [pRes, aRes, cRes] = await Promise.all([
      supabase.from('patients').select('*, assigned:profiles(full_name)').eq('id', id).single(),
      supabase
        .from('appointments')
        .select('*, profiles(full_name)')
        .eq('patient_id', id)
        .order('datetime_start', { ascending: false })
        .limit(10),
      supabase
        .from('conversations')
        .select('*')
        .eq('patient_id', id)
        .order('last_message_at', { ascending: false })
        .limit(5),
    ])
    if (pRes.error) throw pRes.error

    let recentMessages: any[] = []
    if (cRes.data && cRes.data.length > 0) {
      const convIds = cRes.data.map((c) => c.id)
      const mRes = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(20)
      if (mRes.data) recentMessages = mRes.data
    }
    return {
      patient: pRes.data,
      appointments: aRes.data || [],
      conversations: cRes.data || [],
      recentMessages,
    }
  },

  async createPatient(tenant_id: string, data: Partial<Patient>) {
    const sanitizedData = sanitizeEmptyStrings(data)
    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        ...sanitizedData,
        tenant_id,
        pipeline_stage: sanitizedData.pipeline_stage || 'lead',
        source: sanitizedData.source || 'manual',
      } as any)
      .select()
      .single()
    if (error) throw error
    return patient
  },

  async updatePatient(id: string, data: Partial<Patient>) {
    const { id: _, tenant_id, created_at, ...updateData } = data as any
    const sanitizedData = sanitizeEmptyStrings(updateData)
    const { data: patient, error } = await supabase
      .from('patients')
      .update(sanitizedData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return patient
  },

  async deletePatient(id: string) {
    const { error } = await supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return true
  },

  async movePatient(id: string, new_stage: string) {
    const { data, error } = await supabase
      .from('patients')
      .update({ pipeline_stage: new_stage, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async fetchPatientsByStage(tenant_id: string) {
    const { data, error } = await supabase
      .from('patients')
      .select('*, assigned:profiles(full_name)')
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (error) throw error
    const grouped: Record<string, any[]> = {
      lead: [],
      contact: [],
      scheduled: [],
      consultation: [],
      return: [],
      procedure: [],
    }
    data.forEach((p) => {
      if (grouped[p.pipeline_stage]) grouped[p.pipeline_stage].push(p)
      else grouped[p.pipeline_stage] = [p]
    })
    return grouped
  },

  async fetchPatientStats(tenant_id: string) {
    const { data, error } = await supabase
      .from('patients')
      .select('source, pipeline_stage')
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null)
    if (error) throw error
    const by_source: Record<string, number> = {}
    const by_stage: Record<string, number> = {}
    data.forEach((p) => {
      by_source[p.source] = (by_source[p.source] || 0) + 1
      by_stage[p.pipeline_stage] = (by_stage[p.pipeline_stage] || 0) + 1
    })
    return { by_source, by_stage }
  },
}
