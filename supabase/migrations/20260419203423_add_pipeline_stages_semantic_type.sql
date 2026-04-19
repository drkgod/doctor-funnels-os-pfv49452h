ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS semantic_type TEXT DEFAULT NULL;

ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_semantic_type_check;
ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_semantic_type_check 
  CHECK (semantic_type IS NULL OR semantic_type IN ('entry', 'booked', 'completed', 'cancelled'));

DROP INDEX IF EXISTS unique_semantic_type_per_pipeline;
CREATE UNIQUE INDEX IF NOT EXISTS unique_semantic_type_per_pipeline ON public.pipeline_stages (pipeline_id, semantic_type) WHERE semantic_type IS NOT NULL;

DO $$
BEGIN
  UPDATE public.pipeline_stages 
    SET description = 'Paciente acabou de entrar em contato pela primeira vez. Ainda nao demonstrou interesse especifico.', 
        semantic_type = 'entry' 
    WHERE slug = 'lead' AND is_default = true;

  UPDATE public.pipeline_stages 
    SET description = 'Paciente respondeu mensagens e demonstrou interesse. Aguardando mais informacoes ou agendamento.', 
        semantic_type = NULL 
    WHERE slug = 'contact' AND is_default = true;

  UPDATE public.pipeline_stages 
    SET description = 'Paciente tem uma consulta agendada no sistema. Aguardando a data da consulta.', 
        semantic_type = 'booked' 
    WHERE slug = 'scheduled' AND is_default = true;

  UPDATE public.pipeline_stages 
    SET description = 'Paciente realizou a consulta. Em fase de avaliacao ou inicio de tratamento.', 
        semantic_type = 'completed' 
    WHERE slug = 'consultation' AND is_default = true;

  UPDATE public.pipeline_stages 
    SET description = 'Paciente precisa de retorno ou consulta de acompanhamento.', 
        semantic_type = NULL 
    WHERE slug = 'return' AND is_default = true;

  UPDATE public.pipeline_stages 
    SET description = 'Paciente em fase de procedimento, exame ou tratamento especifico.', 
        semantic_type = NULL 
    WHERE slug = 'procedure' AND is_default = true;
END $$;
