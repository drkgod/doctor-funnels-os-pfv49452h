CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pipelines_tenant_id ON public.pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_tenant_id_default ON public.pipelines(tenant_id, is_default);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    color TEXT DEFAULT '#6B7A99',
    icon TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(pipeline_id, slug),
    UNIQUE(pipeline_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON public.pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant_id ON public.pipeline_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_slug ON public.pipeline_stages(slug);

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_pipeline_id ON public.patients(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_patients_pipeline_stage_id ON public.patients(pipeline_stage_id);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_crud" ON public.pipelines;
CREATE POLICY "tenant_crud" ON public.pipelines
  FOR ALL TO public
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "super_admin_all" ON public.pipelines;
CREATE POLICY "super_admin_all" ON public.pipelines
  FOR ALL TO public
  USING (get_user_role() = 'super_admin'::text)
  WITH CHECK (get_user_role() = 'super_admin'::text);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_crud" ON public.pipeline_stages;
CREATE POLICY "tenant_crud" ON public.pipeline_stages
  FOR ALL TO public
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "super_admin_all" ON public.pipeline_stages;
CREATE POLICY "super_admin_all" ON public.pipeline_stages
  FOR ALL TO public
  USING (get_user_role() = 'super_admin'::text)
  WITH CHECK (get_user_role() = 'super_admin'::text);

DROP TRIGGER IF EXISTS set_updated_at ON public.pipelines;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pipelines FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.pipeline_stages;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pipeline_stages FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DO $MIGRATION$
DECLARE
    v_tenant RECORD;
    v_pipeline_id UUID;
    v_stage_lead UUID;
    v_stage_contact UUID;
    v_stage_scheduled UUID;
    v_stage_consultation UUID;
    v_stage_return UUID;
    v_stage_procedure UUID;
    v_patients_count INTEGER;
BEGIN
    FOR v_tenant IN SELECT id FROM public.tenants LOOP
        SELECT id INTO v_pipeline_id FROM public.pipelines WHERE tenant_id = v_tenant.id AND name = 'Principal' LIMIT 1;
        
        IF v_pipeline_id IS NULL THEN
            v_pipeline_id := gen_random_uuid();
            INSERT INTO public.pipelines (id, tenant_id, name, description, is_default, position)
            VALUES (v_pipeline_id, v_tenant.id, 'Principal', 'Pipeline padrão da clínica', true, 0);

            v_stage_lead := gen_random_uuid();
            v_stage_contact := gen_random_uuid();
            v_stage_scheduled := gen_random_uuid();
            v_stage_consultation := gen_random_uuid();
            v_stage_return := gen_random_uuid();
            v_stage_procedure := gen_random_uuid();

            INSERT INTO public.pipeline_stages (id, pipeline_id, tenant_id, name, slug, color, icon, position, is_default) VALUES
            (v_stage_lead, v_pipeline_id, v_tenant.id, 'Novo Lead', 'lead', '#6366F1', 'user-plus', 0, true),
            (v_stage_contact, v_pipeline_id, v_tenant.id, 'Contato', 'contact', '#F59E0B', 'message-circle', 1, false),
            (v_stage_scheduled, v_pipeline_id, v_tenant.id, 'Agendado', 'scheduled', '#3B82F6', 'calendar-check', 2, false),
            (v_stage_consultation, v_pipeline_id, v_tenant.id, 'Em Consulta', 'consultation', '#8B5CF6', 'stethoscope', 3, false),
            (v_stage_return, v_pipeline_id, v_tenant.id, 'Retorno', 'return', '#10B981', 'rotate-ccw', 4, false),
            (v_stage_procedure, v_pipeline_id, v_tenant.id, 'Procedimento', 'procedure', '#EC4899', 'heart-pulse', 5, false);
            
            UPDATE public.patients p
            SET 
                pipeline_id = v_pipeline_id,
                pipeline_stage_id = CASE p.pipeline_stage
                    WHEN 'lead' THEN v_stage_lead
                    WHEN 'contact' THEN v_stage_contact
                    WHEN 'scheduled' THEN v_stage_scheduled
                    WHEN 'consultation' THEN v_stage_consultation
                    WHEN 'return' THEN v_stage_return
                    WHEN 'procedure' THEN v_stage_procedure
                    ELSE v_stage_lead
                END
            WHERE p.tenant_id = v_tenant.id;
            
            GET DIAGNOSTICS v_patients_count = ROW_COUNT;
            RAISE NOTICE 'Migrated % patients for tenant %', v_patients_count, v_tenant.id;
        END IF;
    END LOOP;
END $MIGRATION$;
