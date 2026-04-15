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
import { Card } from '@/components/ui/card'

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

  const triggerClass =
    'px-5 py-2.5 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent hover:text-foreground/80 data-[state=active]:shadow-none data-[state=active]:bg-transparent'

  return (
    <GenericPage
      title="Configurações"
      subtitle="Gerencie seu perfil, clínica, notificações e segurança."
    >
      <div className="mt-6">
        {loading ? (
          <div className="space-y-0">
            <div className="flex space-x-0 border-b border-border mb-7">
              <Skeleton className="h-10 w-24 rounded-none" />
              <Skeleton className="h-10 w-24 rounded-none" />
              <Skeleton className="h-10 w-32 rounded-none" />
              <Skeleton className="h-10 w-24 rounded-none" />
            </div>
            <Card className="p-7 border-border rounded-xl shadow-sm bg-card">
              <div className="space-y-6">
                <Skeleton className="h-8 w-1/4" />
                <div className="flex items-center space-x-5">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <Skeleton className="h-9 w-32" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </Card>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card">
            <p className="text-lg font-medium mb-4">Não foi possível carregar as configurações.</p>
            <Button onClick={handleRetry}>Tentar novamente</Button>
          </div>
        ) : (
          <Tabs defaultValue="perfil" className="w-full">
            <TabsList className="mb-7 flex w-full sm:w-auto overflow-x-auto justify-start border-b border-border bg-transparent h-auto p-0 rounded-none">
              <TabsTrigger value="perfil" className={triggerClass}>
                Perfil
              </TabsTrigger>
              <TabsTrigger value="clinica" className={triggerClass}>
                Clínica
              </TabsTrigger>
              <TabsTrigger value="notificacoes" className={triggerClass}>
                Notificações
              </TabsTrigger>
              <TabsTrigger value="seguranca" className={triggerClass}>
                Segurança
              </TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="mt-0">
              <ProfileTab
                profile={profile}
                onUpdate={(data) => setProfile({ ...profile, ...data })}
              />
            </TabsContent>

            <TabsContent value="clinica" className="mt-0">
              <ClinicTab
                tenant={tenant}
                profile={profile}
                onUpdate={(data) => setTenant({ ...tenant, ...data })}
              />
            </TabsContent>

            <TabsContent value="notificacoes" className="mt-0">
              <NotificationsTab />
            </TabsContent>

            <TabsContent value="seguranca" className="mt-0">
              <SecurityTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </GenericPage>
  )
}
