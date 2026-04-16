import { supabase } from '@/lib/supabase/client'

export const signatureService = {
  async requestSignature(recordId: string, doctorId: string, tenantId: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(new Date().getTime() + 600000).toISOString()

    const { data, error } = await supabase
      .from('verification_codes')
      .insert({
        record_id: recordId,
        code,
        type: 'signature',
        expires_at: expiresAt,
        hash_code: crypto.randomUUID(),
        document_type: 'medical_record',
        document_id: recordId,
        tenant_id: tenantId,
        signer_name: 'Temp',
        signed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return code
  },

  async confirmSignature(recordId: string, doctorId: string, tenantId: string, code: string) {
    const { data: verifyCode, error: fetchError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('record_id', recordId)
      .eq('code', code)
      .eq('type', 'signature')
      .is('used_at', null)
      .maybeSingle()

    if (fetchError || !verifyCode) {
      throw new Error('Codigo invalido ou expirado.')
    }

    if (new Date(verifyCode.expires_at) < new Date()) {
      throw new Error('Codigo expirado. Solicite um novo.')
    }

    const uniqueId1 = Math.random().toString(36).substring(2, 10).toUpperCase()
    const uniqueId2 = Math.random().toString(36).substring(2, 6).toUpperCase()
    const uniqueId3 = Math.random().toString(36).substring(2, 6).toUpperCase()
    const verificationHash = `SIG-${uniqueId1}-${uniqueId2}-${uniqueId3}`

    const { error: insertError } = await supabase.from('document_signatures').insert({
      record_id: recordId,
      doctor_id: doctorId,
      tenant_id: tenantId,
      signature_type: 'pin_confirmation',
      verification_code: verificationHash,
      ip_address: '',
      signed_at: new Date().toISOString(),
      document_type: 'medical_record',
      document_id: recordId,
      signer_id: doctorId,
      signer_name: 'Doctor',
      signature_hash: verificationHash,
    })

    if (insertError) throw insertError

    await supabase
      .from('verification_codes')
      .update({
        used_at: new Date().toISOString(),
      })
      .eq('id', verifyCode.id)

    await supabase
      .from('medical_records')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_hash: verificationHash,
      })
      .eq('id', recordId)

    return {
      success: true,
      verification_code: verificationHash,
      signed_at: new Date().toISOString(),
    }
  },

  async verifySignature(verificationCode: string) {
    const { data: sig, error } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('verification_code', verificationCode)
      .maybeSingle()

    if (error || !sig) return null

    const [doctorRes, recordRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, specialty')
        .eq('id', sig.doctor_id)
        .maybeSingle(),
      supabase
        .from('medical_records')
        .select('record_type, created_at')
        .eq('id', sig.record_id)
        .maybeSingle(),
    ])

    return {
      valid: true,
      doctor_name: doctorRes.data?.full_name || sig.signer_name,
      specialty: doctorRes.data?.specialty,
      record_type: recordRes.data?.record_type,
      signed_at: sig.signed_at,
      verification_code: sig.verification_code,
    }
  },

  async getSignatureForRecord(recordId: string) {
    const { data, error } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('record_id', recordId)
      .maybeSingle()

    if (error) return null
    return data
  },
}
