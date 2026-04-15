import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Database } from '@/lib/supabase/types'

type Tenant = Database['public']['Tables']['tenants']['Row']
type TenantModule = Database['public']['Tables']['tenant_modules']['Row']

export function useTenant() {
  const { user } = useAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [modules, setModules] = useState<TenantModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadTenant() {
      if (!user) {
        if (mounted) setLoading(false)
        return
      }

      try {
        if (mounted) setLoading(true)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError
        if (!profile?.tenant_id) {
          if (mounted) {
            setError('Usuário sem tenant vinculado.')
            setLoading(false)
          }
          return
        }

        const tenantId = profile.tenant_id

        const [tenantRes, modulesRes] = await Promise.all([
          supabase.from('tenants').select('*').eq('id', tenantId).single(),
          supabase.from('tenant_modules').select('*').eq('tenant_id', tenantId),
        ])

        if (tenantRes.error) throw tenantRes.error
        if (modulesRes.error) throw modulesRes.error

        if (mounted) {
          setTenant(tenantRes.data)
          setModules(modulesRes.data || [])
        }
      } catch (err: any) {
        console.error(err)
        if (mounted) setError(err.message || 'Erro ao carregar dados do tenant.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadTenant()

    return () => {
      mounted = false
    }
  }, [user])

  const isModuleEnabled = useCallback(
    (module_key: string) => {
      return modules.some((m) => m.module_key === module_key && m.is_enabled)
    },
    [modules],
  )

  return { tenant, modules, loading, error, isModuleEnabled }
}
