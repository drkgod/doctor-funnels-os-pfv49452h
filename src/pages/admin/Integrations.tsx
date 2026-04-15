import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plug,
  AlertTriangle,
  Clock,
  MessageCircle,
  Building2,
  Search,
  MoreHorizontal,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  fetchAllIntegrations,
  fetchIntegrationStats,
  updateIntegrationStatus,
  deleteIntegration,
} from '@/services/integrationService'

export default function Integrations() {
  const { toast } = useToast()
  const [integrations, setIntegrations] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(false)
      const [statsData, listData] = await Promise.all([
        fetchIntegrationStats(),
        fetchAllIntegrations(),
      ])
      setStats(statsData)
      setIntegrations(listData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUpdateStatus = async (id: string, status: 'active' | 'error') => {
    try {
      await updateIntegrationStatus(id, status)
      toast({ title: 'Status atualizado' })
      loadData()
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteIntegration(deleteId)
      toast({ title: 'Integração removida' })
      setDeleteId(null)
      loadData()
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    }
  }

  const filteredData = useMemo(() => {
    let data = integrations
    if (activeTab === 'uazapi') data = data.filter((i) => i.provider === 'uazapi')
    else if (activeTab === 'resend') data = data.filter((i) => i.provider === 'resend')
    else if (activeTab === 'google_calendar')
      data = data.filter((i) => i.provider === 'google_calendar')
    if (debouncedSearch)
      data = data.filter((i) => i.tenant_name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    return data
  }, [integrations, activeTab, debouncedSearch])

  const paginatedData = useMemo(
    () => filteredData.slice((page - 1) * 20, page * 20),
    [filteredData, page],
  )
  useEffect(() => {
    setPage(1)
  }, [activeTab, debouncedSearch])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center pt-20">
        <p className="text-destructive mb-4">
          Não foi possível carregar as integrações. Tente novamente.
        </p>
        <Button onClick={loadData}>Tentar Novamente</Button>
      </div>
    )
  }

  const uazapiIntegrations = integrations.filter((i) => i.provider === 'uazapi')
  const connected = uazapiIntegrations.filter(
    (i) => i.status === 'active' && i.metadata?.instance_status === 'connected',
  ).length
  const disconnected = uazapiIntegrations.filter(
    (i) => i.status === 'active' && i.metadata?.instance_status !== 'connected',
  ).length
  const errors = uazapiIntegrations.filter((i) => i.status === 'error').length

  return (
    <div className="max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">Conexões com serviços externos e APIs</p>
      </div>

      {loading && !stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-lg" />
            ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
          <div className="p-5 bg-card border border-border rounded-lg">
            <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center">
              <Plug className="w-[18px] h-[18px] text-success" />
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-3">Integrações Ativas</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total_active}</p>
          </div>
          <div className="p-5 bg-card border border-border rounded-lg">
            <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-[18px] h-[18px] text-destructive" />
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-3">Com Erro</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total_error}</p>
          </div>
          <div className="p-5 bg-card border border-border rounded-lg">
            <div className="w-9 h-9 rounded-full bg-[hsl(45_93%_47%)]/10 flex items-center justify-center">
              <Clock className="w-[18px] h-[18px] text-[hsl(45_93%_47%)]" />
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-3">Expiradas</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total_expired}</p>
          </div>
          <div className="p-5 bg-card border border-border rounded-lg">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-[18px] h-[18px] text-primary" />
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-3">WhatsApp Conectados</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.whatsapp_connected}/{stats.total_tenants}
            </p>
          </div>
          <div className="p-5 bg-card border border-border rounded-lg">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="w-[18px] h-[18px] text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-3">Tenants sem Integração</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.tenants_without_integration}
            </p>
          </div>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-7">
        <TabsList className="bg-transparent border-b border-border w-full justify-start h-auto p-0 rounded-none mb-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground/80 rounded-none"
          >
            Todas
          </TabsTrigger>
          <TabsTrigger
            value="uazapi"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground/80 rounded-none"
          >
            UAZAPI
          </TabsTrigger>
          <TabsTrigger
            value="resend"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground/80 rounded-none"
          >
            Resend
          </TabsTrigger>
          <TabsTrigger
            value="google_calendar"
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground/80 rounded-none"
          >
            Google Calendar
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 mb-4">
          {activeTab === 'uazapi' && (
            <div className="mb-4 p-3 px-4 bg-card border border-border rounded-lg flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-[13px] font-medium">{connected} conectados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-[13px] font-medium">{disconnected} desconectados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[hsl(45_93%_47%)]" />
                <span className="text-[13px] font-medium">{errors} com erro</span>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tenant..."
              className="h-10 w-full lg:w-auto lg:min-w-[280px] bg-input border-border rounded-lg pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
              <TableRow className="border-border">
                <TableHead className="px-4 py-2.5 h-auto">Tenant</TableHead>
                <TableHead className="px-4 py-2.5 h-auto">Provedor</TableHead>
                <TableHead className="px-4 py-2.5 h-auto">Plano</TableHead>
                <TableHead className="px-4 py-2.5 h-auto">Status</TableHead>
                <TableHead className="px-4 py-2.5 h-auto">Detalhes</TableHead>
                <TableHead className="px-4 py-2.5 h-auto">Atualizado</TableHead>
                <TableHead className="px-4 py-2.5 h-auto text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && integrations.length === 0 ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell colSpan={7} className="px-4 py-2.5">
                        <Skeleton className="h-4 w-full bg-secondary/50 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="pt-[60px] pb-16 text-center">
                    <Plug className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-base font-semibold mt-4">Nenhuma integração configurada</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      As integrações aparecerão aqui quando os tenants forem configurados.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-border hover:bg-secondary/50 transition-colors"
                  >
                    <TableCell className="px-4 py-2.5 text-[13px]">
                      <Link
                        to={`/admin/tenants/${item.tenant_id}`}
                        className="font-medium text-primary hover:underline cursor-pointer"
                      >
                        {item.tenant_name}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-[13px]">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium">
                        <div
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            item.status === 'active'
                              ? 'bg-success'
                              : item.status === 'error'
                                ? 'bg-destructive'
                                : 'bg-[hsl(45_93%_47%)]',
                          )}
                        />
                        {item.provider === 'uazapi'
                          ? 'UAZAPI (WhatsApp)'
                          : item.provider === 'resend'
                            ? 'Resend (Email)'
                            : 'Google Calendar'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-[13px]">
                      <Badge
                        variant="outline"
                        className="text-[11px] px-2 py-0.5 rounded-full border-border font-normal"
                      >
                        {item.tenant_plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-[13px]">
                      <Badge
                        className={cn(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-full border-transparent',
                          item.status === 'active'
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : item.status === 'error'
                              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                              : 'bg-[hsl(45_93%_47%)]/10 text-[hsl(45_93%_47%)] hover:bg-[hsl(45_93%_47%)]/20',
                        )}
                      >
                        {item.status === 'active'
                          ? 'Ativo'
                          : item.status === 'error'
                            ? 'Erro'
                            : 'Expirado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-[13px]">
                      <div className="text-xs text-muted-foreground">
                        {item.provider === 'uazapi' ? (
                          <>
                            <span className="font-medium">
                              {item.metadata?.instance_status || 'N/A'}
                            </span>{' '}
                            {item.metadata?.phone_number && (
                              <span className="font-mono">({item.metadata.phone_number})</span>
                            )}
                          </>
                        ) : item.provider === 'resend' ? (
                          <span className="font-medium">Configurado</span>
                        ) : (
                          <span className="font-medium">{item.metadata?.email || 'N/A'}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-[13px] text-muted-foreground">
                      {format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="w-8 h-8 p-0 hover:bg-secondary">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-card border-border shadow-[0_4px_12px_rgba(0,0,0,0.1)] min-w-[160px]"
                        >
                          <DropdownMenuItem asChild className="px-3 py-2 text-[13px]">
                            <Link to={`/admin/tenants/${item.tenant_id}`}>Ver Tenant</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(item.id, 'active')}
                            className="px-3 py-2 text-[13px]"
                          >
                            Marcar como Ativo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(item.id, 'error')}
                            className="px-3 py-2 text-[13px]"
                          >
                            Marcar como Erro
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(item.id)}
                            className="px-3 py-2 text-[13px] text-destructive"
                          >
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredData.length > 20 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-4">
            <span className="text-[13px] text-muted-foreground">
              Mostrando {(page - 1) * 20 + 1} a {Math.min(page * 20, filteredData.length)} de{' '}
              {filteredData.length} integrações
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= filteredData.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Integração?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
