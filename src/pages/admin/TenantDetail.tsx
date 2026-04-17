import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Box,
  Activity,
  Mail,
  Calendar as CalIcon,
  Zap,
  FileText,
  CircleSlash,
  WifiOff,
  XCircle,
  RefreshCw,
  Save,
  Trash2,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { tenantService } from '@/services/tenantService'
import { whatsappAdminService } from '@/services/whatsappAdminService'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { getPlanBadgeClasses, getStatusBadgeClasses } from './AdminDashboard'

const moduleNames: Record<string, string> = {
  crm: 'CRM',
  whatsapp: 'WhatsApp',
  email: 'Email',
  agenda: 'Agenda',
  dashboard: 'Dashboard',
  templates: 'Templates',
  automations: 'Automações',
  ai_chatbot: 'Chatbot IA',
  prontuarios: 'Prontuarios',
  reports: 'Relatorios',
}

function getModuleIcon(key: string) {
  switch (key) {
    case 'crm':
      return Activity
    case 'whatsapp':
      return MessageCircle
    case 'email':
      return Mail
    case 'agenda':
      return CalIcon
    case 'dashboard':
      return Activity
    case 'templates':
      return Box
    case 'automations':
      return Zap
    case 'ai_chatbot':
      return Box
    case 'prontuarios':
      return FileText
    case 'reports':
      return Activity
    default:
      return Box
  }
}

function DebouncedLimit({ mod, limitKey, value, onUpdate }: any) {
  const [val, setVal] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (val !== value) onUpdate(mod.module_key, limitKey, val)
    }, 500)
    return () => clearTimeout(timer)
  }, [val, value, onUpdate, limitKey, mod.module_key])
  return (
    <div className="mt-2">
      <Label className="block text-[12px] text-muted-foreground mb-1">{limitKey}</Label>
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full max-w-[120px] h-9 px-3 text-[13px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

export default function TenantDetail() {
  const { id } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [intOpen, setIntOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const [editData, setEditData] = useState<any>({})
  const [newInt, setNewInt] = useState({ provider: 'resend', key: '' })
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (intOpen && data) {
      const existing = data.apiKeys.map((k: any) => k.provider)
      if (!existing.includes('resend')) {
        setNewInt((prev) => ({ ...prev, provider: 'resend', key: '' }))
      } else if (!existing.includes('google_calendar')) {
        setNewInt((prev) => ({ ...prev, provider: 'google_calendar', key: '' }))
      } else if (!existing.includes('openai')) {
        setNewInt((prev) => ({ ...prev, provider: 'openai', key: '' }))
      } else if (!existing.includes('deepgram')) {
        setNewInt((prev) => ({ ...prev, provider: 'deepgram', key: '' }))
      }
    }
  }, [intOpen, data])
  const [unassigned, setUnassigned] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState('Modulos')
  const tabs = ['Modulos', 'WhatsApp', 'Integracoes', 'Usuarios', 'Logs']

  const mockLogs = [
    {
      id: '1',
      timestamp: '15/04/2026 14:30:22',
      action: 'Módulo WhatsApp ativado',
      details: 'O administrador ativou o módulo de WhatsApp para este tenant.',
    },
    {
      id: '2',
      timestamp: '14/04/2026 09:15:00',
      action: 'Tenant criado',
      details: 'Tenant criado via painel administrativo.',
    },
  ]
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [creatingInstance, setCreatingInstance] = useState(false)

  const [waStatus, setWaStatus] = useState<any>(null)
  const [loadingWa, setLoadingWa] = useState(false)
  const [waToken, setWaToken] = useState('')
  const [showWaToken, setShowWaToken] = useState(false)
  const [savingWa, setSavingWa] = useState(false)
  const [showRemoveWaDialog, setShowRemoveWaDialog] = useState(false)
  const [removingWa, setRemovingWa] = useState(false)

  const [reconfiguringWebhook, setReconfiguringWebhook] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)

  const webhookUrl = `https://jttfhlvfufivpoufkufp.supabase.co/functions/v1/handle-uazapi-webhook?tenant_id=${id}`

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast.success('URL copiada!')
  }

  const reconfigureWebhook = async () => {
    setReconfiguringWebhook(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-whatsapp-create-instance', {
        body: { tenant_id: id, reconfigure_webhook: true },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      if (data?.webhook_configured) {
        toast.success('Webhook reconfigurado com sucesso.')
      } else {
        toast.warning(
          data?.message || 'Webhook não configurado automaticamente. Configure manualmente.',
        )
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reconfigurar webhook.')
    } finally {
      setReconfiguringWebhook(false)
    }
  }

  const testWebhook = async () => {
    setTestingWebhook(true)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'connection',
          data: { state: 'connected', phoneNumber: 'test' },
        }),
      })
      if (res.ok) {
        toast.success(`Webhook funcionando! Status: ${res.status}`)
        loadWaStatus()
      } else {
        toast.error(`Webhook retornou erro: ${res.status}`)
      }
    } catch (e) {
      toast.error('Nao foi possivel alcancar o webhook. Verifique se a funcao esta deployada.')
    } finally {
      setTestingWebhook(false)
    }
  }

  const loadWaStatus = async () => {
    if (!id) return
    setLoadingWa(true)
    try {
      const res = await whatsappAdminService.getInstanceStatus(id)
      setWaStatus(res)
    } catch (e) {
      setWaStatus({
        connected: false,
        status: 'error',
        configured: false,
        message: 'Erro ao verificar status.',
      })
    } finally {
      setLoadingWa(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'WhatsApp') {
      loadWaStatus()
    }
  }, [activeTab, id])

  const loadData = async () => {
    try {
      const res = await tenantService.fetchTenantById(id!)
      setData(res)
      setEditData(res.tenant)
    } catch (e) {
      toast.error('Erro ao carregar tenant')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    if (!userOpen) return
    const timer = setTimeout(async () => {
      try {
        setUnassigned(await tenantService.searchUnassignedUsers(userSearch))
      } catch (e) {
        // Handle gracefully
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch, userOpen])

  if (loading)
    return (
      <div className="max-w-7xl mx-auto w-full pb-10">
        <div className="w-32 h-4 mb-6 shimmer-card rounded-md"></div>
        <div className="w-1/2 h-8 mb-6 shimmer-card rounded-md"></div>
        <div className="w-full h-12 mb-6 shimmer-card rounded-md"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="w-full h-32 shimmer-card rounded-md"></div>
          <div className="w-full h-32 shimmer-card rounded-md"></div>
          <div className="w-full h-32 shimmer-card rounded-md"></div>
          <div className="w-full h-32 shimmer-card rounded-md"></div>
        </div>
      </div>
    )

  if (!data)
    return (
      <div className="p-8 text-center text-destructive">
        <p className="mb-4">Erro ao carregar dados do tenant.</p>
        <button
          onClick={loadData}
          className="h-10 px-4 rounded-[var(--radius)] border border-destructive text-destructive font-medium hover:bg-destructive/10"
        >
          Tentar novamente
        </button>
      </div>
    )

  const { tenant, modules, apiKeys, users } = data
  const wappKey = apiKeys.find((k: any) => k.provider === 'uazapi')
  const otherKeys = apiKeys.filter((k: any) => k.provider !== 'uazapi')

  const existingProviders = apiKeys.map((k: any) => k.provider)
  const canAddResend = !existingProviders.includes('resend')
  const canAddGoogle = !existingProviders.includes('google_calendar')
  const canAddOpenai = !existingProviders.includes('openai')
  const canAddDeepgram = !existingProviders.includes('deepgram')
  const allConfigured = !canAddResend && !canAddGoogle && !canAddOpenai && !canAddDeepgram

  const handleUpdate = async () => {
    try {
      await tenantService.updateTenant(id!, {
        name: editData.name,
        plan: editData.plan,
        status: editData.status,
        address: editData.address,
        phone: editData.phone,
      })
      toast.success('Tenant atualizado')
      setEditOpen(false)
      loadData()
    } catch (e) {
      toast.error('Erro ao atualizar')
    }
  }

  const toggleMod = async (mod: any, val: boolean) => {
    try {
      await tenantService.toggleModule(id!, mod.module_key, val)
      toast.success('Módulo atualizado')
      loadData()
    } catch (e) {
      toast.error('Erro ao atualizar módulo')
    }
  }

  const updateLimit = async (modKey: string, limitKey: string, val: number) => {
    try {
      const mod = modules.find((m: any) => m.module_key === modKey)
      await tenantService.updateModuleLimits(id!, modKey, { ...mod.limits, [limitKey]: val })
      toast.success('Limite atualizado')
      loadData()
    } catch (e) {
      toast.error('Erro ao atualizar limite')
    }
  }

  const createInstance = async () => {
    setCreatingInstance(true)
    try {
      await tenantService.createWhatsappInstance(id!)
      toast.success('Instância criada com sucesso')
      loadData()
    } catch (e) {
      toast.error('Erro ao criar instância')
    } finally {
      setCreatingInstance(false)
    }
  }

  const removeKey = async (keyId: string) => {
    if (!confirm('Tem certeza? Isso vai desconectar a integração do cliente.')) return
    try {
      await tenantService.removeApiKey(keyId)
      toast.success('Integração removida')
      loadData()
    } catch (e) {
      toast.error('Erro ao remover integração')
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full pb-10 animate-fade-in">
      <Link
        to="/admin/tenants"
        className="text-[13px] text-muted-foreground hover:text-primary flex items-center gap-1 mb-6 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar aos tenants
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-[24px] font-bold text-foreground leading-none">{tenant.name}</h1>
        <span className="text-muted-foreground ml-2">{tenant.slug}</span>
        <span
          className={cn(
            'text-[12px] font-semibold px-[10px] py-[3px] rounded-full inline-block capitalize',
            getPlanBadgeClasses(tenant.plan),
          )}
        >
          {tenant.plan}
        </span>
        <span
          className={cn(
            'text-[12px] font-semibold px-[10px] py-[3px] rounded-full inline-block capitalize',
            getStatusBadgeClasses(tenant.status),
          )}
        >
          {tenant.status}
        </span>
        <button
          onClick={() => setEditOpen(true)}
          className="ml-auto text-[14px] text-primary hover:underline font-medium"
        >
          Editar
        </button>
      </div>

      <div className="mt-6 mb-6">
        <div className="flex border-b border-border overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-[14px] font-medium whitespace-nowrap transition-colors',
                activeTab === tab
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Modulos' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {modules.map((m: any) => {
            const Icon = getModuleIcon(m.module_key)
            return (
              <div
                key={m.id}
                className={cn(
                  'p-5 bg-card border rounded-[var(--radius)] transition-colors',
                  m.is_enabled
                    ? 'border-l-[3px] border-l-success border-t-border border-r-border border-b-border'
                    : 'border-l-[3px] border-l-muted/30 border-t-border border-r-border border-b-border',
                )}
              >
                <Icon
                  className={cn('w-6 h-6', m.is_enabled ? 'text-primary' : 'text-muted-foreground')}
                />
                <h3 className="text-[14px] font-semibold text-foreground mt-2">
                  {moduleNames[m.module_key] || m.module_key}
                </h3>
                <div className="mt-3">
                  <Switch checked={m.is_enabled} onCheckedChange={(v) => toggleMod(m, v)} />
                </div>
                {m.limits &&
                  Object.entries(m.limits).map(([lk, lv]) => (
                    <DebouncedLimit
                      key={lk}
                      mod={m}
                      limitKey={lk}
                      value={lv}
                      onUpdate={updateLimit}
                    />
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'WhatsApp' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section 1: Status Card */}
          <div className="p-6 bg-card border border-border rounded-[var(--radius)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-foreground">Status da Conexão</h3>
              <button
                onClick={loadWaStatus}
                disabled={loadingWa}
                className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-4 h-4', loadingWa && 'animate-spin')} />
                Atualizar Status
              </button>
            </div>

            {loadingWa && !waStatus ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            ) : waStatus ? (
              <div className="space-y-4">
                {!waStatus.configured || waStatus.status === 'not_configured' ? (
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 text-muted-foreground text-[13px] font-medium mb-2 border border-border">
                      <CircleSlash className="w-4 h-4" />
                      Não Configurado
                    </div>
                    <p className="text-[14px] text-muted-foreground">
                      Nenhuma instância UAZAPI registrada para este tenant. Cadastre o token abaixo.
                    </p>
                  </div>
                ) : waStatus.status === 'error' ? (
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[13px] font-medium mb-2 border border-destructive/20">
                      <XCircle className="w-4 h-4" />
                      Erro
                    </div>
                    <p className="text-[14px] text-muted-foreground mb-3">
                      {waStatus.message || 'Erro ao verificar status da instância.'}
                    </p>
                    <button
                      onClick={loadWaStatus}
                      className="h-8 px-3 rounded-[var(--radius)] border border-border text-[12px] font-medium hover:bg-secondary transition-colors outline-style inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Tentar novamente
                    </button>
                  </div>
                ) : waStatus.configured && !waStatus.connected ? (
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[13px] font-medium mb-2 border border-amber-500/20">
                      <WifiOff className="w-4 h-4" />
                      Desconectado
                    </div>
                    <p className="text-[14px] text-muted-foreground">
                      Instância configurada. O cliente precisa escanear o QR Code na página de
                      WhatsApp dele.
                    </p>
                    {waStatus.phone && (
                      <p className="text-[14px] font-medium text-foreground mt-2">
                        Número: {waStatus.phone}
                      </p>
                    )}
                  </div>
                ) : waStatus.connected ? (
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-[13px] font-medium mb-2 border border-success/20">
                      <CheckCircle2 className="w-4 h-4" />
                      Conectado
                    </div>
                    {waStatus.phone && (
                      <p className="text-[14px] font-medium text-foreground mt-2">
                        Número: {waStatus.phone}
                      </p>
                    )}
                    {waStatus.connected_at && (
                      <p className="text-[13px] text-muted-foreground mt-1">
                        Última conexão: {new Date(waStatus.connected_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Section 2: Configuration Form */}
          <div className="p-6 bg-card border border-border rounded-[var(--radius)]">
            <h3 className="text-[16px] font-semibold text-foreground mb-6">
              Configurar Instância UAZAPI
            </h3>

            <div className="max-w-md space-y-4">
              <div>
                <Label className="block text-[13px] font-medium mb-1">
                  Token da Instância <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <input
                    type={showWaToken ? 'text' : 'password'}
                    value={waToken}
                    onChange={(e) => setWaToken(e.target.value)}
                    placeholder="Cole aqui o token da instância UAZAPI"
                    className="w-full h-10 px-3 pr-10 text-[14px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWaToken(!showWaToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[12px] text-muted-foreground mt-2">
                  O subdomínio UAZAPI é configurado globalmente pelo servidor. Cada tenant recebe
                  apenas o token da sua instância.
                </p>
              </div>

              {waStatus?.configured && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius)]">
                  <p className="text-[13px] text-amber-500 font-medium">
                    Salvar novamente irá substituir o token atual e reconfigurar o webhook.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!waToken) {
                      toast.error('O token é obrigatório.')
                      return
                    }
                    setSavingWa(true)
                    try {
                      const res = await whatsappAdminService.registerInstance(id!, waToken)
                      toast.success(
                        `Instância UAZAPI configurada com sucesso! ${res.webhook_configured ? 'Webhook configurado automaticamente.' : '(Webhook precisa ser configurado manualmente)'}`,
                      )
                      setWaToken('')
                      loadWaStatus()
                      loadData() // Refresh general tenant data too
                    } catch (e: any) {
                      toast.error(e.message || 'Erro ao salvar configuração.')
                    } finally {
                      setSavingWa(false)
                    }
                  }}
                  disabled={savingWa || !waToken}
                  className="h-10 px-4 bg-primary text-primary-foreground text-[14px] font-medium rounded-[var(--radius)] hover:bg-primary/90 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {savingWa ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar e Configurar
                </button>

                {waStatus?.configured && (
                  <>
                    <button
                      onClick={reconfigureWebhook}
                      disabled={reconfiguringWebhook}
                      className="h-10 px-4 border border-border text-foreground text-[14px] font-medium rounded-[var(--radius)] hover:bg-secondary transition-colors outline-style inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn('w-4 h-4', reconfiguringWebhook && 'animate-spin')}
                      />
                      Reconfigurar Webhook
                    </button>
                    <button
                      onClick={() => setShowRemoveWaDialog(true)}
                      className="h-10 px-4 border border-destructive text-destructive text-[14px] font-medium rounded-[var(--radius)] hover:bg-destructive/10 transition-colors outline-style inline-flex items-center gap-2 ml-auto sm:ml-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover Instância
                    </button>
                  </>
                )}
              </div>
            </div>

            {waStatus?.configured && (
              <div className="mt-8 border-t border-border pt-6 max-w-2xl">
                <h4 className="text-[15px] font-semibold text-foreground mb-3">URL do Webhook</h4>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 bg-secondary/50 font-mono text-[12px] p-3 rounded-[var(--radius)] border border-border overflow-x-auto whitespace-nowrap text-muted-foreground select-all">
                    {webhookUrl}
                  </div>
                  <button
                    onClick={copyWebhookUrl}
                    className="h-11 px-3 border border-border text-foreground rounded-[var(--radius)] hover:bg-secondary transition-colors"
                    title="Copiar URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Se o webhook nao configurou automaticamente, copie esta URL e configure
                  manualmente no painel UAZAPI: doctorfunnels.uazapi.com, secao Webhooks, campo URL.
                </p>
                <button
                  onClick={testWebhook}
                  disabled={testingWebhook}
                  className="h-9 px-4 border border-border text-foreground text-[13px] font-medium rounded-[var(--radius)] hover:bg-secondary transition-colors outline-style inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Zap
                    className={cn('w-4 h-4', testingWebhook && 'animate-pulse text-amber-500')}
                  />
                  Testar Webhook
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Integracoes' && (
        <div className="animate-fade-in">
          {!allConfigured && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setIntOpen(true)}
                className="h-9 px-4 bg-primary text-primary-foreground text-[14px] font-medium rounded-[var(--radius)] hover:bg-primary/90 transition-colors"
              >
                Adicionar Integração
              </button>
            </div>
          )}
          {otherKeys.length === 0 ? (
            <div className="p-8 text-center border border-border rounded-[var(--radius)] bg-card border-dashed">
              <p className="text-muted-foreground text-[14px]">Nenhuma integração configurada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {otherKeys.map((k: any) => (
                <div
                  key={k.id}
                  className="p-5 bg-card border border-border rounded-[var(--radius)] flex flex-col"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
                    <Box className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-foreground mb-1">
                    {k.provider === 'openai' ? (
                      'OpenAI (GPT)'
                    ) : k.provider === 'deepgram' ? (
                      'Deepgram (Transcricao)'
                    ) : (
                      <span className="capitalize">{k.provider}</span>
                    )}
                  </h3>
                  {k.provider === 'openai' && (
                    <p className="text-[12px] text-muted-foreground mb-2 line-clamp-2">
                      Usado para gerar prontuarios, receitas e laudos com IA
                    </p>
                  )}
                  {k.provider === 'deepgram' && (
                    <p className="text-[12px] text-muted-foreground mb-2 line-clamp-2">
                      Usado para transcrever consultas com diarizacao medico/paciente
                    </p>
                  )}
                  {k.provider === 'resend' && (
                    <p className="text-[12px] text-muted-foreground mb-2 line-clamp-2">
                      Usado para envio de emails e campanhas
                    </p>
                  )}
                  {k.provider === 'google_calendar' && (
                    <p className="text-[12px] text-muted-foreground mb-2 line-clamp-2">
                      Sincronizacao com Google Calendar
                    </p>
                  )}
                  <div className="mb-3">
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block',
                        getStatusBadgeClasses(k.status),
                      )}
                    >
                      {k.status}
                    </span>
                  </div>
                  <div className="mt-auto pt-2">
                    <button className="w-full h-9 rounded-[var(--radius)] border border-border text-[13px] font-medium hover:bg-secondary transition-colors mb-2 outline-style">
                      Configurar
                    </button>
                    <button
                      onClick={() => removeKey(k.id)}
                      className="w-full h-8 text-[12px] text-destructive hover:bg-destructive/10 rounded-[var(--radius)] transition-colors ghost-style"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {allConfigured && (
            <div className="mt-4 text-center">
              <p className="text-[13px] text-muted-foreground">
                Todas as integrações estão configuradas
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Usuarios' && (
        <div className="animate-fade-in">
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setUserOpen(true)}
              className="h-9 px-4 border border-border text-foreground text-[14px] font-medium rounded-[var(--radius)] flex items-center gap-1 hover:bg-secondary transition-colors outline-style"
            >
              <Plus className="w-4 h-4" /> Vincular Usuário
            </button>
          </div>
          <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                    <th className="px-4 py-3 whitespace-nowrap">Nome</th>
                    <th className="px-4 py-3 whitespace-nowrap">Email</th>
                    <th className="px-4 py-3 whitespace-nowrap">Role</th>
                    <th className="px-4 py-3 whitespace-nowrap w-[100px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-[14px] text-muted-foreground"
                      >
                        Nenhum usuário vinculado
                      </td>
                    </tr>
                  )}
                  {users.map((u: any) => (
                    <tr
                      key={u.id}
                      className="border-b border-border hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-[14px] font-medium whitespace-nowrap">
                        {u.full_name}
                      </td>
                      <td className="px-4 py-3 text-[14px] text-muted-foreground whitespace-nowrap">
                        {u.email || '-'}
                      </td>
                      <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                        {u.role === 'doctor' ? 'Médico' : 'Secretária'}
                      </td>
                      <td className="px-4 py-3 text-[14px] text-right whitespace-nowrap">
                        <button
                          onClick={async () => {
                            if (confirm('Desvincular este usuário?')) {
                              await tenantService.removeUserFromTenant(u.id)
                              loadData()
                            }
                          }}
                          className="text-destructive text-[13px] hover:underline font-medium"
                        >
                          Desvincular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Logs' && (
        <div className="animate-fade-in">
          <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                    <th className="px-4 py-3 w-[160px] whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-3 whitespace-nowrap">Ação</th>
                    <th className="px-4 py-3 whitespace-nowrap">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-[12px] font-mono text-muted-foreground whitespace-nowrap align-top">
                        {log.timestamp}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium align-top text-foreground">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground align-top">
                        <div className={cn('max-w-2xl', expandedLog !== log.id && 'truncate')}>
                          {log.details}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Editar Informações</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">Nome</Label>
              <input
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">Endereço</Label>
              <input
                value={editData.address || ''}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">Telefone</Label>
              <input
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setEditOpen(false)}
              className="h-10 px-4 rounded-[var(--radius)] border border-border text-[14px] font-medium hover:bg-secondary transition-colors outline-style"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpdate}
              className="h-10 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={intOpen} onOpenChange={setIntOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Adicionar Integração</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">Provedor</Label>
              <Select
                value={newInt.provider}
                onValueChange={(v) => setNewInt({ ...newInt, provider: v })}
              >
                <SelectTrigger className="h-10 text-[14px] rounded-[var(--radius)] bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[var(--radius)]">
                  <SelectItem value="resend" disabled={!canAddResend}>
                    Resend{' '}
                    {!canAddResend && (
                      <span className="text-muted-foreground"> (já configurado)</span>
                    )}
                  </SelectItem>
                  <SelectItem value="google_calendar" disabled={!canAddGoogle}>
                    Google Calendar{' '}
                    {!canAddGoogle && (
                      <span className="text-muted-foreground"> (já configurado)</span>
                    )}
                  </SelectItem>
                  <SelectItem value="openai" disabled={!canAddOpenai}>
                    OpenAI (GPT){' '}
                    {!canAddOpenai && (
                      <span className="text-muted-foreground"> (já configurado)</span>
                    )}
                  </SelectItem>
                  <SelectItem value="deepgram" disabled={!canAddDeepgram}>
                    Deepgram (Transcricao){' '}
                    {!canAddDeepgram && (
                      <span className="text-muted-foreground"> (já configurado)</span>
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">API Key</Label>
              <input
                type="password"
                value={newInt.key}
                onChange={(e) => setNewInt({ ...newInt, key: e.target.value })}
                className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setIntOpen(false)}
              className="h-10 px-4 rounded-[var(--radius)] border border-border text-[14px] font-medium hover:bg-secondary transition-colors outline-style"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                try {
                  await tenantService.addApiKey(id!, newInt.provider, newInt.key)
                  toast.success('Adicionada')
                  setIntOpen(false)
                  setNewInt({ provider: 'resend', key: '' })
                  loadData()
                } catch (e: any) {
                  toast.error(e.message || 'Erro')
                }
              }}
              className="h-10 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Vincular Usuário</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <input
              placeholder="Buscar por nome..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring mb-4"
            />
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {unassigned.length === 0 && userSearch.length > 2 && (
                <p className="text-center text-[14px] text-muted-foreground py-4">
                  Nenhum usuário encontrado
                </p>
              )}
              {unassigned.map((u) => (
                <div
                  key={u.id}
                  className="flex justify-between items-center p-3 border border-border rounded-[var(--radius)] bg-card"
                >
                  <div>
                    <p className="text-[14px] font-medium text-foreground">{u.full_name}</p>
                    <p className="text-[12px] text-muted-foreground">{u.email}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await tenantService.assignUserToTenant(u.id, id!)
                      toast.success('Vinculado')
                      loadData()
                      setUnassigned(unassigned.filter((x) => x.id !== u.id))
                    }}
                    className="h-8 px-3 bg-primary text-primary-foreground text-[13px] font-medium rounded-[var(--radius)] hover:bg-primary/90 transition-colors"
                  >
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRemoveWaDialog} onOpenChange={setShowRemoveWaDialog}>
        <DialogContent className="sm:max-w-[425px] p-6 rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-destructive">
              Remover Instância UAZAPI
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-[14px] text-muted-foreground">
              Tem certeza? O WhatsApp deste tenant será desconectado e o token removido. O cliente
              perderá acesso ao WhatsApp.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setShowRemoveWaDialog(false)}
              disabled={removingWa}
              className="h-10 px-4 rounded-[var(--radius)] border border-border text-[14px] font-medium hover:bg-secondary transition-colors outline-style"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                setRemovingWa(true)
                try {
                  await whatsappAdminService.removeInstance(id!)
                  toast.success('Instância removida com sucesso.')
                  setShowRemoveWaDialog(false)
                  loadWaStatus()
                  loadData()
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao remover instância.')
                } finally {
                  setRemovingWa(false)
                }
              }}
              disabled={removingWa}
              className="h-10 px-4 rounded-[var(--radius)] bg-destructive text-destructive-foreground text-[14px] font-medium hover:bg-destructive/90 transition-colors flex items-center gap-2"
            >
              {removingWa ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Sim, Remover
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
