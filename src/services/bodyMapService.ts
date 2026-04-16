import { supabase } from '@/lib/supabase/client'

export interface BodyMapPoint {
  id: string
  x: number
  y: number
  label: string
  product?: string
  units?: string
  lot_number?: string
  notes?: string
  color?: string
}

export const bodyMapService = {
  async fetchBodyMaps(record_id: string) {
    const { data, error } = await supabase.from('body_maps').select('*').eq('record_id', record_id)
    if (error) throw error
    return data || []
  },

  async saveBodyMap(record_id: string, map_type: string, points: BodyMapPoint[], notes?: string) {
    const { data: existing, error: checkError } = await supabase
      .from('body_maps')
      .select('id')
      .eq('record_id', record_id)
      .eq('map_type', map_type)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') throw checkError

    if (existing) {
      const { data, error } = await supabase
        .from('body_maps')
        .update({ points: points as any, notes: notes || '' })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      return data
    } else {
      const { data, error } = await supabase
        .from('body_maps')
        .insert({
          record_id,
          map_type,
          points: points as any,
          notes: notes || '',
        })
        .select()
        .single()
      if (error) throw error
      return data
    }
  },

  async deleteBodyMap(body_map_id: string) {
    const { error } = await supabase.from('body_maps').delete().eq('id', body_map_id)
    if (error) throw error
    return true
  },
}
