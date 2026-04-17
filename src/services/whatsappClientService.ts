import { supabase } from '@/lib/supabase/client'

export const whatsappClientService = {
  getMyWhatsAppStatus: async () => {
    const { data, error } = await supabase.functions.invoke('whatsapp-status', {
      body: {},
    })
    if (error) throw error
    return data
  },
  connectMyWhatsApp: async () => {
    const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
      body: {},
    })
    if (error) throw error
    return data
  },
}
