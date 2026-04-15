import { useEffect, useState } from 'react'
import { GenericPage } from '@/components/GenericPage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileTab } from './settings/ProfileTab'
import { ClinicTab } from './settings/ClinicTab'
import { NotificationsTab } from './settings/NotificationsTab'
import { SecurityTab } from './settings/SecurityTab'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export default function Settings() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError
        setProfile(profileData)

        if (profileData.tenant_id) {
          const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', profileData.tenant_id)
            .single()

          if (!tenantError) setTenant(tenantData)
        }
      } catch (err) {
        console.error('Error loading settings:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  const handleRetry = () => {
    setError(false)
    setLoading(true)
    window.location.reload()
  }

  return (
    <GenericPage
      title="Configurações"
      subtitle="Gerencie seu perfil, clínica, notificações e segurança."
    >
      <div className="mt-6">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card">
            <p className="text-lg font-medium mb-4">Não foi possível carregar as configurações.</p>
            <Button onClick={handleRetry}>Tentar novamente</Button>
          </div>
        ) : (
          <Tabs defaultValue="perfil" className="w-full">
            <TabsList className="mb-6 flex w-full sm:w-auto overflow-x-auto justify-start">
              <TabsTrigger value="perfil">Perfil</TabsTrigger>
              <TabsTrigger value="clinica">Clínica</TabsTrigger>
              <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
              <TabsTrigger value="seguranca">Segurança</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil">
              <ProfileTab
                profile={profile}
                onUpdate={(data) => setProfile({ ...profile, ...data })}
              />
            </TabsContent>

            <TabsContent value="clinica">
              <ClinicTab
                tenant={tenant}
                profile={profile}
                onUpdate={(data) => setTenant({ ...tenant, ...data })}
              />
            </TabsContent>

            <TabsContent value="notificacoes">
              <NotificationsTab />
            </TabsContent>

            <TabsContent value="seguranca">
              <SecurityTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </GenericPage>
  )
}
