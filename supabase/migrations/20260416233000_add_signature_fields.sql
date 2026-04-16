ALTER TABLE public.verification_codes ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.verification_codes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.verification_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.verification_codes ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE public.verification_codes ADD COLUMN IF NOT EXISTS record_id UUID REFERENCES public.medical_records(id);

ALTER TABLE public.document_signatures ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE public.document_signatures ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.document_signatures ADD COLUMN IF NOT EXISTS record_id UUID REFERENCES public.medical_records(id);
ALTER TABLE public.document_signatures ADD COLUMN IF NOT EXISTS signature_type TEXT;
ALTER TABLE public.document_signatures ADD COLUMN IF NOT EXISTS ip_address TEXT;
