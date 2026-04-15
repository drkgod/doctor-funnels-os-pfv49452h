-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tables Creation

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  plan text NOT NULL DEFAULT 'essential' CHECK (plan IN ('essential', 'professional', 'clinic')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  logo_url text,
  address text,
  phone text,
  business_hours jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.tenant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL CHECK (module_key IN ('crm', 'whatsapp', 'email', 'agenda', 'dashboard', 'templates', 'automations', 'ai_chatbot')),
  is_enabled boolean NOT NULL DEFAULT false,
  limits jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_modules_tenant_key UNIQUE (tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('uazapi', 'resend', 'google_calendar')),
  encrypted_key text NOT NULL,
  metadata jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'doctor' CHECK (role IN ('super_admin', 'doctor', 'secretary')),
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  cpf text,
  date_of_birth date,
  gender text CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL),
  address text,
  source text NOT NULL DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'form', 'phone', 'referral', 'doctoralia', 'manual')),
  tags text[] DEFAULT '{}',
  notes text,
  pipeline_stage text NOT NULL DEFAULT 'lead' CHECK (pipeline_stage IN ('lead', 'contact', 'scheduled', 'consultation', 'return', 'procedure')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  datetime_start timestamptz NOT NULL,
  datetime_end timestamptz NOT NULL,
  type text NOT NULL DEFAULT 'consultation' CHECK (type IN ('consultation', 'return', 'procedure')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'cancelled', 'no_show', 'completed')),
  google_event_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  uazapi_chat_id text,
  phone_number text NOT NULL,
  last_message_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'closed')),
  is_bot_active boolean NOT NULL DEFAULT true,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type text NOT NULL CHECK (sender_type IN ('patient', 'bot', 'human')),
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'document', 'video')),
  uazapi_message_id text,
  delivery_status text CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed') OR delivery_status IS NULL),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  category text NOT NULL DEFAULT 'marketing' CHECK (category IN ('transactional', 'marketing', 'automation')),
  variables text[] DEFAULT '{}',
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  segment_filter jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  bounced_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('stage_change', 'time_after_event', 'new_lead', 'manual', 'webhook')),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  action_type text NOT NULL CHECK (action_type IN ('send_whatsapp', 'send_email', 'move_pipeline', 'create_task')),
  action_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  execution_count integer NOT NULL DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  model text NOT NULL DEFAULT 'gpt-4o',
  system_prompt text NOT NULL DEFAULT '',
  temperature numeric NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens integer NOT NULL DEFAULT 1024,
  rag_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_configs_tenant_id_key UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.bot_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bot_config_id uuid NOT NULL REFERENCES public.bot_configs(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  embedding_status text NOT NULL DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'ready', 'error')),
  chunk_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bot_document_id uuid NOT NULL REFERENCES public.bot_documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_email_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month date NOT NULL,
  emails_sent integer NOT NULL DEFAULT 0,
  limit_reached boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_email_usage_tenant_month_key UNIQUE (tenant_id, month)
);

CREATE TABLE IF NOT EXISTS public.tenant_whatsapp_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month date NOT NULL,
  messages_sent integer NOT NULL DEFAULT 0,
  messages_received integer NOT NULL DEFAULT 0,
  limit_reached boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_whatsapp_usage_tenant_month_key UNIQUE (tenant_id, month)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes

CREATE INDEX IF NOT EXISTS tenants_slug_idx ON public.tenants(slug);

CREATE INDEX IF NOT EXISTS tenant_modules_tenant_id_idx ON public.tenant_modules(tenant_id);

CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_id_idx ON public.tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_api_keys_provider_idx ON public.tenant_api_keys(provider);

CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

CREATE INDEX IF NOT EXISTS patients_tenant_id_idx ON public.patients(tenant_id);
CREATE INDEX IF NOT EXISTS patients_pipeline_stage_idx ON public.patients(pipeline_stage);
CREATE INDEX IF NOT EXISTS patients_phone_idx ON public.patients(phone);
CREATE INDEX IF NOT EXISTS patients_deleted_at_idx ON public.patients(deleted_at);

CREATE INDEX IF NOT EXISTS appointments_tenant_id_idx ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_datetime_start_idx ON public.appointments(datetime_start);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);

CREATE INDEX IF NOT EXISTS conversations_tenant_id_idx ON public.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS conversations_phone_number_idx ON public.conversations(phone_number);
CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx ON public.conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS messages_tenant_id_idx ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);

CREATE INDEX IF NOT EXISTS email_templates_tenant_id_idx ON public.email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS email_templates_category_idx ON public.email_templates(category);

CREATE INDEX IF NOT EXISTS email_campaigns_tenant_id_idx ON public.email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON public.email_campaigns(status);

CREATE INDEX IF NOT EXISTS automations_tenant_id_idx ON public.automations(tenant_id);
CREATE INDEX IF NOT EXISTS automations_is_active_idx ON public.automations(is_active);

CREATE INDEX IF NOT EXISTS automation_logs_tenant_id_idx ON public.automation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS automation_logs_automation_id_idx ON public.automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS automation_logs_executed_at_idx ON public.automation_logs(executed_at DESC);

CREATE INDEX IF NOT EXISTS bot_configs_tenant_id_idx ON public.bot_configs(tenant_id);

CREATE INDEX IF NOT EXISTS bot_documents_tenant_id_idx ON public.bot_documents(tenant_id);
CREATE INDEX IF NOT EXISTS bot_documents_bot_config_id_idx ON public.bot_documents(bot_config_id);

CREATE INDEX IF NOT EXISTS bot_embeddings_tenant_id_idx ON public.bot_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS bot_embeddings_embedding_idx ON public.bot_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs(action);

-- Realtime for messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;

-- 3. Functions & Triggers

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tenants', 'tenant_modules', 'tenant_api_keys', 'profiles', 
    'patients', 'appointments', 'conversations', 'email_templates', 
    'email_campaigns', 'automations', 'bot_configs', 'tenant_email_usage', 
    'tenant_whatsapp_usage'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');
  IF v_name = '' THEN
    v_name := 'Usuario';
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, v_name, 'doctor')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.create_default_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_modules (tenant_id, module_key, is_enabled, limits)
  VALUES 
    (NEW.id, 'crm', true, NULL),
    (NEW.id, 'agenda', true, NULL),
    (NEW.id, 'dashboard', true, NULL),
    (NEW.id, 'whatsapp', false, '{"max_whatsapp_month": 500}'::jsonb),
    (NEW.id, 'email', false, '{"max_emails_month": 1000}'::jsonb),
    (NEW.id, 'templates', false, NULL),
    (NEW.id, 'automations', false, NULL),
    (NEW.id, 'ai_chatbot', false, NULL)
  ON CONFLICT (tenant_id, module_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;
CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_modules();

-- 4. RLS Policies

-- Enable RLS for all newly created tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tenants', 'tenant_modules', 'tenant_api_keys', 'profiles', 
    'patients', 'appointments', 'conversations', 'messages', 'email_templates', 
    'email_campaigns', 'automations', 'automation_logs', 'bot_configs', 
    'bot_documents', 'bot_embeddings', 'tenant_email_usage', 'tenant_whatsapp_usage', 
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END;
$$;

-- Universal Super Admin Policy
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tenants', 'tenant_modules', 'tenant_api_keys', 'profiles', 
    'patients', 'appointments', 'conversations', 'messages', 'email_templates', 
    'email_campaigns', 'automations', 'automation_logs', 'bot_configs', 
    'bot_documents', 'bot_embeddings', 'tenant_email_usage', 'tenant_whatsapp_usage', 
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "super_admin_all" ON public.%I FOR ALL USING (public.get_user_role() = ''super_admin'')', t);
  END LOOP;
END;
$$;

-- Tenants
DROP POLICY IF EXISTS "tenant_members_select" ON public.tenants;
CREATE POLICY "tenant_members_select" ON public.tenants FOR SELECT USING (id = public.get_user_tenant_id());

-- Tenant Modules
DROP POLICY IF EXISTS "tenant_members_select" ON public.tenant_modules;
CREATE POLICY "tenant_members_select" ON public.tenant_modules FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Tenant API Keys
DROP POLICY IF EXISTS "tenant_members_select" ON public.tenant_api_keys;
CREATE POLICY "tenant_members_select" ON public.tenant_api_keys FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Profiles
DROP POLICY IF EXISTS "users_own_profile" ON public.profiles;
CREATE POLICY "users_own_profile" ON public.profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users_own_profile_update" ON public.profiles;
CREATE POLICY "users_own_profile_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "tenant_members_select" ON public.profiles;
CREATE POLICY "tenant_members_select" ON public.profiles FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Patients
DROP POLICY IF EXISTS "tenant_crud" ON public.patients;
CREATE POLICY "tenant_crud" ON public.patients FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Appointments
DROP POLICY IF EXISTS "tenant_crud" ON public.appointments;
CREATE POLICY "tenant_crud" ON public.appointments FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Conversations
DROP POLICY IF EXISTS "tenant_crud" ON public.conversations;
CREATE POLICY "tenant_crud" ON public.conversations FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Messages
DROP POLICY IF EXISTS "tenant_crud" ON public.messages;
CREATE POLICY "tenant_crud" ON public.messages FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Email Templates
DROP POLICY IF EXISTS "tenant_crud" ON public.email_templates;
CREATE POLICY "tenant_crud" ON public.email_templates FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "global_templates_select" ON public.email_templates;
CREATE POLICY "global_templates_select" ON public.email_templates FOR SELECT USING (is_global = true);

-- Email Campaigns
DROP POLICY IF EXISTS "tenant_crud" ON public.email_campaigns;
CREATE POLICY "tenant_crud" ON public.email_campaigns FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Automations
DROP POLICY IF EXISTS "tenant_crud" ON public.automations;
CREATE POLICY "tenant_crud" ON public.automations FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Automation Logs
DROP POLICY IF EXISTS "tenant_select" ON public.automation_logs;
CREATE POLICY "tenant_select" ON public.automation_logs FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Bot Configs
DROP POLICY IF EXISTS "tenant_select" ON public.bot_configs;
CREATE POLICY "tenant_select" ON public.bot_configs FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Bot Documents
DROP POLICY IF EXISTS "tenant_select" ON public.bot_documents;
CREATE POLICY "tenant_select" ON public.bot_documents FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Tenant Email Usage
DROP POLICY IF EXISTS "tenant_select" ON public.tenant_email_usage;
CREATE POLICY "tenant_select" ON public.tenant_email_usage FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Tenant Whatsapp Usage
DROP POLICY IF EXISTS "tenant_select" ON public.tenant_whatsapp_usage;
CREATE POLICY "tenant_select" ON public.tenant_whatsapp_usage FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- Audit Logs
DROP POLICY IF EXISTS "tenant_select" ON public.audit_logs;
CREATE POLICY "tenant_select" ON public.audit_logs FOR SELECT USING (tenant_id = public.get_user_tenant_id());

