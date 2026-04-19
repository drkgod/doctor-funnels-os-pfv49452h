DO $$
BEGIN
  -- Insert policy for tenant_api_keys
  DROP POLICY IF EXISTS "tenant_insert_api_keys" ON public.tenant_api_keys;
  CREATE POLICY "tenant_insert_api_keys" ON public.tenant_api_keys
    FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

  -- Update policy for tenant_api_keys
  DROP POLICY IF EXISTS "tenant_update_api_keys" ON public.tenant_api_keys;
  CREATE POLICY "tenant_update_api_keys" ON public.tenant_api_keys
    FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
END $$;
