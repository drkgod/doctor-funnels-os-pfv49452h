import { supabase } from '@/lib/supabase/client'

export interface Pipeline {
  id: string
  tenant_id: string
  name: string
  description: string | null
  is_default: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  tenant_id: string
  name: string
  slug: string
  color: string
  icon: string | null
  position: number
  is_default: boolean
  description: string | null
  semantic_type: string | null
  created_at: string
  updated_at: string
}

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[]
}

export const pipelineService = {
  async getPipelines(tenantId: string): Promise<Pipeline[]> {
    const { data, error } = await (supabase as any)
      .from('pipelines')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getPipelineWithStages(pipelineId: string): Promise<PipelineWithStages | null> {
    const { data: pipeline, error: pipelineError } = await (supabase as any)
      .from('pipelines')
      .select('*')
      .eq('id', pipelineId)
      .single()

    if (pipelineError) throw pipelineError
    if (!pipeline) return null

    const { data: stages, error: stagesError } = await (supabase as any)
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true })

    if (stagesError) throw stagesError

    return { ...pipeline, stages: stages || [] }
  },

  async getStageBySemanticType(
    pipelineId: string,
    semanticType: string,
  ): Promise<PipelineStage | null> {
    const { data, error } = await (supabase as any)
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .eq('semantic_type', semanticType)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async getDefaultPipeline(tenantId: string): Promise<PipelineWithStages | null> {
    let { data: pipeline, error: pipelineError } = await (supabase as any)
      .from('pipelines')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()

    if (pipelineError) throw pipelineError

    if (!pipeline) {
      const { data: firstPipeline, error: firstError } = await (supabase as any)
        .from('pipelines')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstError) throw firstError
      pipeline = firstPipeline
    }

    if (!pipeline) return null

    const { data: stages, error: stagesError } = await (supabase as any)
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipeline.id)
      .order('position', { ascending: true })

    if (stagesError) throw stagesError

    return { ...pipeline, stages: stages || [] }
  },

  async createPipeline(
    tenantId: string,
    name: string,
    description: string | null,
  ): Promise<Pipeline> {
    const { data: existing, error: queryError } = await (supabase as any)
      .from('pipelines')
      .select('position')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: false })
      .limit(1)

    if (queryError) throw queryError

    const maxPosition = existing && existing.length > 0 ? existing[0].position : -1

    const { data, error } = await (supabase as any)
      .from('pipelines')
      .insert({
        tenant_id: tenantId,
        name,
        description,
        is_default: false,
        position: maxPosition + 1,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePipeline(pipelineId: string, data: Partial<Pipeline>): Promise<Pipeline> {
    if (data.is_default) {
      const { data: p } = await (supabase as any)
        .from('pipelines')
        .select('tenant_id')
        .eq('id', pipelineId)
        .single()

      if (p) {
        await (supabase as any)
          .from('pipelines')
          .update({ is_default: false })
          .eq('tenant_id', p.tenant_id)
      }
    }

    const { data: updated, error } = await (supabase as any)
      .from('pipelines')
      .update(data)
      .eq('id', pipelineId)
      .select()
      .single()

    if (error) throw error
    return updated
  },

  async deletePipeline(pipelineId: string): Promise<{ success: boolean; error?: string }> {
    const { data: pipeline, error: queryError } = await (supabase as any)
      .from('pipelines')
      .select('is_default')
      .eq('id', pipelineId)
      .single()

    if (queryError) return { success: false, error: 'Pipeline não encontrado.' }
    if (pipeline.is_default)
      return { success: false, error: 'Não é possível excluir o pipeline padrão.' }

    const { count, error: countError } = await (supabase as any)
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('pipeline_id', pipelineId)

    if (countError) return { success: false, error: 'Erro ao verificar pacientes do pipeline.' }
    if (count && count > 0)
      return {
        success: false,
        error: 'Existem pacientes neste pipeline. Mova-os antes de excluir.',
      }

    const { error: deleteError } = await (supabase as any)
      .from('pipelines')
      .delete()
      .eq('id', pipelineId)

    if (deleteError) return { success: false, error: 'Erro ao excluir pipeline.' }
    return { success: true }
  },

  async getStages(pipelineId: string): Promise<PipelineStage[]> {
    const { data, error } = await (supabase as any)
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createStage(
    pipelineId: string,
    tenantId: string,
    name: string,
    slug: string,
    color: string,
    description?: string | null,
    semantic_type?: string | null,
  ): Promise<PipelineStage> {
    if (semantic_type) {
      const { data: existingSem } = await (supabase as any)
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .eq('semantic_type', semantic_type)
        .maybeSingle()
      if (existingSem)
        throw new Error(
          `Ja existe uma etapa com o tipo automatico '${semantic_type}' neste pipeline. Remova o tipo da outra etapa antes.`,
        )
    }

    const { data: existing, error: queryError } = await (supabase as any)
      .from('pipeline_stages')
      .select('position')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: false })
      .limit(1)

    if (queryError) throw queryError

    const maxPosition = existing && existing.length > 0 ? existing[0].position : -1

    const { data, error } = await (supabase as any)
      .from('pipeline_stages')
      .insert({
        pipeline_id: pipelineId,
        tenant_id: tenantId,
        name,
        slug,
        color,
        description: description || null,
        semantic_type: semantic_type || null,
        is_default: false,
        position: maxPosition + 1,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateStage(stageId: string, data: Partial<PipelineStage>): Promise<PipelineStage> {
    if (data.semantic_type !== undefined) {
      const { data: s } = await (supabase as any)
        .from('pipeline_stages')
        .select('pipeline_id')
        .eq('id', stageId)
        .single()

      if (s && data.semantic_type !== null) {
        const { data: existingSem } = await (supabase as any)
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', s.pipeline_id)
          .eq('semantic_type', data.semantic_type)
          .neq('id', stageId)
          .maybeSingle()
        if (existingSem)
          throw new Error(
            `Ja existe uma etapa com o tipo automatico '${data.semantic_type}' neste pipeline. Remova o tipo da outra etapa antes.`,
          )
      }
    }

    if (data.is_default) {
      const { data: s } = await (supabase as any)
        .from('pipeline_stages')
        .select('pipeline_id')
        .eq('id', stageId)
        .single()

      if (s) {
        await (supabase as any)
          .from('pipeline_stages')
          .update({ is_default: false })
          .eq('pipeline_id', s.pipeline_id)
      }
    }

    const { data: updated, error } = await (supabase as any)
      .from('pipeline_stages')
      .update(data)
      .eq('id', stageId)
      .select()
      .single()

    if (error) throw error
    return updated
  },

  async deleteStage(stageId: string): Promise<{ success: boolean; error?: string }> {
    const { data: stage, error: queryError } = await (supabase as any)
      .from('pipeline_stages')
      .select('is_default')
      .eq('id', stageId)
      .single()

    if (queryError) return { success: false, error: 'Etapa não encontrada.' }
    if (stage.is_default) return { success: false, error: 'Não é possível excluir a etapa padrão.' }

    const { count, error: countError } = await (supabase as any)
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('pipeline_stage_id', stageId)

    if (countError) return { success: false, error: 'Erro ao verificar pacientes na etapa.' }
    if (count && count > 0)
      return {
        success: false,
        error: `Existem ${count} pacientes nesta etapa. Mova-os antes de excluir.`,
      }

    const { error: deleteError } = await (supabase as any)
      .from('pipeline_stages')
      .delete()
      .eq('id', stageId)

    if (deleteError) return { success: false, error: 'Erro ao excluir etapa.' }
    return { success: true }
  },

  async reorderStages(
    pipelineId: string,
    stageIds: string[],
  ): Promise<{ success: boolean; error?: string }> {
    const updates1 = stageIds.map(async (id, index) => {
      await (supabase as any)
        .from('pipeline_stages')
        .update({ position: -1000 - index })
        .eq('id', id)
    })

    await Promise.all(updates1)

    const updates2 = stageIds.map(async (id, index) => {
      await (supabase as any).from('pipeline_stages').update({ position: index }).eq('id', id)
    })

    await Promise.all(updates2)

    return { success: true }
  },

  async movePatientStage(
    patientId: string,
    newStageId: string,
  ): Promise<{ success: boolean; oldStageId?: string; newStageId?: string; error?: string }> {
    const { data: patient, error: patError } = await (supabase as any)
      .from('patients')
      .select('pipeline_stage_id')
      .eq('id', patientId)
      .single()

    if (patError) return { success: false, error: 'Paciente não encontrado.' }

    const oldStageId = patient.pipeline_stage_id

    const { data: newStage, error: stageError } = await (supabase as any)
      .from('pipeline_stages')
      .select('slug')
      .eq('id', newStageId)
      .single()

    if (stageError) return { success: false, error: 'Nova etapa não encontrada.' }

    const { error: updateError } = await (supabase as any)
      .from('patients')
      .update({
        pipeline_stage_id: newStageId,
        pipeline_stage: newStage.slug,
      })
      .eq('id', patientId)

    if (updateError) return { success: false, error: 'Erro ao mover paciente.' }

    return { success: true, oldStageId: oldStageId || undefined, newStageId }
  },
}
