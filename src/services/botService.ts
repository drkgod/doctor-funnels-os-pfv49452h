import { supabase } from '@/lib/supabase/client'

export const botService = {
  async fetchBotConfigs() {
    const { data, error } = await supabase
      .from('bot_configs')
      .select('*, tenants(name)')
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map((bot: any) => ({
      ...bot,
      tenant_name: bot.tenants?.name || 'Tenant Desconhecido',
    }))
  },

  async fetchBotConfigById(id: string) {
    const { data: config, error: configError } = await supabase
      .from('bot_configs')
      .select('*, tenants(name)')
      .eq('id', id)
      .single()

    if (configError) throw configError

    const { data: documents, error: docsError } = await supabase
      .from('bot_documents')
      .select('*')
      .eq('bot_config_id', id)
      .order('created_at', { ascending: false })

    if (docsError) throw docsError

    return {
      config: { ...config, tenant_name: (config as any).tenants?.name },
      documents,
    }
  },

  async fetchBotConfigByTenantId(tenantId: string) {
    const { data, error } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async createBotConfig(tenant_id: string, model = 'gpt-4o', system_prompt = '') {
    const { data, error } = await supabase
      .from('bot_configs')
      .insert({
        tenant_id,
        model,
        system_prompt,
        temperature: 0.7,
        max_tokens: 1024,
        rag_enabled: false,
        status: 'paused',
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateBotConfig(
    id: string,
    updates: Partial<{
      model: string
      system_prompt: string
      temperature: number
      max_tokens: number
      rag_enabled: boolean
      status: string
    }>,
  ) {
    const { data, error } = await supabase
      .from('bot_configs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async toggleBotStatus(id: string, new_status: string) {
    const { data, error } = await supabase
      .from('bot_configs')
      .update({ status: new_status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteBotConfig(id: string) {
    const { error } = await supabase.from('bot_configs').delete().eq('id', id)

    if (error) throw error
    return true
  },

  async uploadBotDocument(tenant_id: string, bot_config_id: string, file: File) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${tenant_id}/${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('bot-documents')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage.from('bot-documents').getPublicUrl(fileName)

    const { data, error: insertError } = await supabase
      .from('bot_documents')
      .insert({
        tenant_id,
        bot_config_id,
        file_name: file.name,
        file_url: publicUrlData.publicUrl,
        embedding_status: 'pending',
        chunk_count: 0,
      })
      .select()
      .single()

    if (insertError) throw insertError

    try {
      await supabase.auth.getSession()
      supabase.functions
        .invoke('process-bot-document', {
          body: {
            tenant_id,
            bot_config_id,
            document_id: data.id,
            file_url: publicUrlData.publicUrl,
            file_name: file.name,
          },
        })
        .catch((err) => console.warn('Erro assíncrono ao invocar process-bot-document:', err))
    } catch (err) {
      console.warn('Erro ao acionar processamento do documento:', err)
    }

    return data
  },

  async deleteBotDocument(id: string, file_url: string) {
    try {
      const urlObj = new URL(file_url)
      const pathParts = urlObj.pathname.split('/bot-documents/')
      if (pathParts.length > 1) {
        const storagePath = pathParts[1]
        await supabase.storage.from('bot-documents').remove([storagePath])
      }
    } catch (e) {
      // Ignora erro de parsing e tenta excluir do BD
    }

    const { error } = await supabase.from('bot_documents').delete().eq('id', id)

    if (error) throw error
    return true
  },

  async fetchBotDocuments(bot_config_id: string) {
    const { data, error } = await supabase
      .from('bot_documents')
      .select('*')
      .eq('bot_config_id', bot_config_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },
}
