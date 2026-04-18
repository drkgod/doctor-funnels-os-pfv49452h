ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text,
ADD COLUMN IF NOT EXISTS media_size integer,
ADD COLUMN IF NOT EXISTS media_filename text,
ADD COLUMN IF NOT EXISTS media_thumbnail_url text,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS quoted_message_id text;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp-media', 'whatsapp-media', false) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Tenant users can read own media" ON storage.objects;
CREATE POLICY "Tenant users can read own media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'whatsapp-media' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);

DROP POLICY IF EXISTS "Service role can insert media" ON storage.objects;
CREATE POLICY "Service role can insert media" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'whatsapp-media');

DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Authenticated users can upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-media' AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text);
