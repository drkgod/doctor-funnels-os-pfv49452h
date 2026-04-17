import { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  identifier: string,
  action: string,
  maxRequests: number,
  windowMinutes: number,
): Promise<boolean> {
  const timeWindow = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  if (action === 'whatsapp-send') {
    const { count } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', identifier)
      .eq('direction', 'outbound')
      .gte('created_at', timeWindow)
    return (count || 0) >= maxRequests
  }

  if (action === 'email-campaign') {
    const { count } = await supabaseAdmin
      .from('email_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', identifier)
      .gte('created_at', timeWindow)
    return (count || 0) >= maxRequests
  }

  if (action === 'whatsapp-connect') {
    const { count } = await supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', identifier)
      .eq('action', 'whatsapp_connect_attempt')
      .gte('created_at', timeWindow)
    return (count || 0) >= maxRequests
  }

  if (action === 'encrypt-api-key') {
    const { count } = await supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', identifier)
      .eq('action', 'encrypt_api_key_attempt')
      .gte('created_at', timeWindow)
    return (count || 0) >= maxRequests
  }

  return false
}
