import { useState, useEffect } from 'react'
import { ModuleGate } from '@/components/ModuleGate'
import { GenericPage } from '@/components/GenericPage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { emailService } from '@/services/emailService'
import { supabase } from '@/lib/supabase/client'
import { TemplatesTab } from './email/TemplatesTab'
import { CampaignsTab } from './email/CampaignsTab'

export default function Email() {
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [usage, setUsage] = useState({ sent: 0, limit: 1000 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const init = async () => {
      try {
        setLoading(true)
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()

        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id)

          const [usageData, moduleData] = await Promise.all([
            emailService.fetchEmailUsage(profile.tenant_id),
            supabase
              .from('tenant_modules')
              .select('limits')
              .eq('tenant_id', profile.tenant_id)
              .eq('module_key', 'email')
              .single(),
          ])

          const sent = usageData?.emails_sent || 0
          const limitParams = moduleData.data?.limits as any
          const limit = limitParams?.max_emails_month || 1000

          setUsage({ sent, limit })
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [user])

  const usagePercent = Math.min((usage.sent / usage.limit) * 100, 100)
  const isHighUsage = usagePercent >= 80
  const isLimitReached = usagePercent >= 100
  const valueColor = isLimitReached
    ? 'text-destructive'
    : isHighUsage
      ? 'text-amber-500'
      : 'text-foreground'

  const barFillColor = isLimitReached
    ? 'bg-destructive'
    : isHighUsage
      ? 'bg-amber-500'
      : 'bg-primary'

  const UsageIndicator = () => (
    <div className="flex flex-col gap-2 px-4 py-2 bg-card border rounded-md min-w-[220px]">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[12px] text-muted-foreground">Emails este mês:</span>
        <span className={`text-[14px] font-semibold ${valueColor}`}>
          {usage.sent} / {usage.limit}
        </span>
      </div>
      <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barFillColor}`}
          style={{ width: `${usagePercent}%` }}
        />
      </div>
    </div>
  )

  return (
    <ModuleGate moduleKey="email">
      <GenericPage
        title="Email"
        subtitle="Campanhas e comunicações transacionais"
        action={<UsageIndicator />}
      >
        <Tabs defaultValue="templates" className="w-full mt-5 mb-6">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b rounded-none mb-6">
            <TabsTrigger
              value="templates"
              className="px-5 py-2.5 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none hover:text-foreground/80 transition-colors"
            >
              Templates
            </TabsTrigger>
            <TabsTrigger
              value="campanhas"
              className="px-5 py-2.5 text-[14px] font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none hover:text-foreground/80 transition-colors"
            >
              Campanhas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="templates" className="mt-0 outline-none">
            <TemplatesTab tenantId={tenantId!} loading={loading} error={error} />
          </TabsContent>
          <TabsContent value="campanhas" className="mt-0 outline-none">
            <CampaignsTab
              tenantId={tenantId!}
              loading={loading}
              error={error}
              onUsageUpdate={() => {
                if (tenantId)
                  emailService
                    .fetchEmailUsage(tenantId)
                    .then((d) =>
                      setUsage((prev) => ({ ...prev, sent: d?.emails_sent || prev.sent })),
                    )
              }}
            />
          </TabsContent>
        </Tabs>
      </GenericPage>
    </ModuleGate>
  )
}
