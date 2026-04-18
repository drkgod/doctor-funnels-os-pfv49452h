DO $$
BEGIN
  UPDATE storage.buckets SET public = true WHERE id = 'whatsapp-media';
END $$;
