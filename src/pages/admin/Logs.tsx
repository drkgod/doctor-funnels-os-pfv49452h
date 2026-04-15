import React, { useState, useEffect } from 'react'
import { Search, ScrollText, Download, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  fetchAuditLogs,
  fetchAuditLogActions,
  exportAuditLogsToCSV,
} from '@/services/auditLogService'

export default function Logs() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<any[]>([])
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [filters, setFilters] = useState({
    actionSearch: '',
    tenant_id: 'all',
    action: 'all',
    date_from: '',
    date_to: '',
  })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortAsc, setSortAsc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.actionSearch), 300)
    return () => clearTimeout(timer)
  }, [filters.actionSearch])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(false)
      const [tenantsRes, actionsData, logsData] = await Promise.all([
        supabase.from('tenants').select('id, name').order('name'),
        fetchAuditLogActions(),
        fetchAuditLogs({
          page,
          per_page: 20,
          sort_asc: sortAsc,
          tenant_id: filters.tenant_id !== 'all' ? filters.tenant_id : undefined,
          action: filters.action !== 'all' ? filters.action : debouncedSearch || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
        }),
      ])
      setTenants(tenantsRes.data || [])
      setActions(actionsData)
      setLogs(logsData.data)
      setTotal(logsData.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [
    page,
    sortAsc,
    debouncedSearch,
    filters.tenant_id,
    filters.action,
    filters.date_from,
    filters.date_to,
  ])

  const handleExport = async () => {
    try {
      await exportAuditLogsToCSV({
        tenant_id: filters.tenant_id !== 'all' ? filters.tenant_id : undefined,
        action: filters.action !== 'all' ? filters.action : debouncedSearch || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        sort_asc: sortAsc,
      })
    } catch {
      toast({ title: 'Erro ao exportar CSV', variant: 'destructive' })
    }
  }

  const formatActionName = (action: string) => {
    const map: Record<string, string> = {
      tenant_created: 'Tenant criado',
      tenant_updated: 'Tenant atualizado',
      module_toggled: 'Módulo alterado',
      api_key_added: 'Chave API adicionada',
      api_key_removed: 'Chave API removida',
      bot_created: 'Bot criado',
      bot_updated: 'Bot atualizado',
      whatsapp_instance_created: 'Instância WhatsApp criada',
      whatsapp_connected: 'WhatsApp conectado',
      whatsapp_disconnected: 'WhatsApp desconectado',
      user_login: 'Login',
      user_signup: 'Cadastro',
    }
    if (map[action]) return map[action]
    return action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  }

  const flattenObject = (obj: any, prefix = ''): Record<string, string> => {
    return Object.keys(obj).reduce((acc: Record<string, string>, k) => {
      const pre = prefix.length ? prefix + '.' : ''
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flattenObject(obj[k], pre + k))
      } else {
        acc[pre + k] = String(obj[k])
      }
      return acc
    }, {})
  }

  const getActionColorClass = (action: string) => {
    const lower = action.toLowerCase()
    if (lower.includes('created') || lower.includes('criado')) return 'text-success'
    if (lower.includes('deleted') || lower.includes('removido') || lower.includes('removed'))
      return 'text-destructive'
    if (lower.includes('error') || lower.includes('disconnected') || lower.includes('desconectado'))
      return 'text-[hsl(45_93%_47%)]'
    if (
      lower.includes('login') ||
      lower.includes('signup') ||
      lower.includes('connected') ||
      lower.includes('conectado')
    )
      return 'text-primary'
    return 'text-foreground'
  }

  const isUUID = (val: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  const isBoolean = (val: string) => val === 'true' || val === 'false'
  const formatValue = (val: string) => {
    if (val === 'true') return 'Sim'
    if (val === 'false') return 'Não'
    if (val === 'null' || val === 'undefined') return '—'
    return val
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center pt-20">
        <p className="text-destructive mb-4">Não foi possível carregar os logs. Tente novamente.</p>
        <Button onClick={loadData}>Tentar Novamente</Button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Logs do Sistema</h1>
        <p className="text-muted-foreground text-sm mt-1">Atividade e auditoria</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end pb-5 border-b border-border mt-6 mb-5">
        {loading && logs.length === 0 ? (
          <>
            <Skeleton className="h-[38px] w-full sm:w-[220px] rounded-lg animate-pulse bg-secondary/50" />
            <Skeleton className="h-[38px] w-full sm:w-[180px] rounded-lg animate-pulse bg-secondary/50" />
            <Skeleton className="h-[38px] w-full sm:w-[180px] rounded-lg animate-pulse bg-secondary/50" />
            <Skeleton className="h-[38px] w-[150px] rounded-lg animate-pulse bg-secondary/50" />
            <Skeleton className="h-[38px] w-[150px] rounded-lg animate-pulse bg-secondary/50" />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1 w-full sm:w-auto flex-1 lg:flex-none">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                Busca
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ação..."
                  className="h-[38px] w-full lg:min-w-[220px] text-[13px] bg-input border-border rounded-lg pl-8"
                  value={filters.actionSearch}
                  onChange={(e) => setFilters((f) => ({ ...f, actionSearch: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                Tenant
              </label>
              <Select
                value={filters.tenant_id}
                onValueChange={(v) => setFilters((f) => ({ ...f, tenant_id: v, page: 1 }))}
              >
                <SelectTrigger className="h-[38px] w-full sm:min-w-[180px] text-[13px] border-border rounded-lg">
                  <SelectValue placeholder="Todos os tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tenants</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                Ação
              </label>
              <Select
                value={filters.action}
                onValueChange={(v) => setFilters((f) => ({ ...f, action: v, page: 1 }))}
              >
                <SelectTrigger className="h-[38px] w-full sm:min-w-[180px] text-[13px] border-border rounded-lg">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {formatActionName(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-full sm:w-auto gap-3">
              <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                  De
                </label>
                <Input
                  type="date"
                  className="h-[38px] w-full sm:w-[150px] text-[13px] border-border rounded-lg"
                  value={filters.date_from}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, date_from: e.target.value, page: 1 }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                  Até
                </label>
                <Input
                  type="date"
                  className="h-[38px] w-full sm:w-[150px] text-[13px] border-border rounded-lg"
                  value={filters.date_to}
                  onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value, page: 1 }))}
                />
              </div>
            </div>

            <Button
              variant="ghost"
              className="h-[38px] text-xs text-muted-foreground hover:text-destructive px-2 py-1 w-full sm:w-auto mt-2 sm:mt-0"
              onClick={() =>
                setFilters({
                  actionSearch: '',
                  tenant_id: 'all',
                  action: 'all',
                  date_from: '',
                  date_to: '',
                })
              }
            >
              Limpar filtros
            </Button>

            <Button
              variant="outline"
              className="h-[38px] text-[13px] gap-1.5 ml-auto w-full sm:w-auto"
              onClick={handleExport}
            >
              <Download className="w-[14px] h-[14px]" /> Exportar CSV
            </Button>
          </>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
            <TableRow className="border-border">
              <TableHead
                className="px-4 py-2.5 h-auto w-[170px] cursor-pointer"
                onClick={() => setSortAsc(!sortAsc)}
              >
                Data {sortAsc ? '↑' : '↓'}
              </TableHead>
              <TableHead className="px-4 py-2.5 h-auto">Tenant</TableHead>
              <TableHead className="px-4 py-2.5 h-auto">Usuário</TableHead>
              <TableHead className="px-4 py-2.5 h-auto">Ação</TableHead>
              <TableHead className="px-4 py-2.5 h-auto">Tipo</TableHead>
              <TableHead className="px-4 py-2.5 h-auto">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && logs.length === 0 ? (
              Array(10)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell className="px-4 py-2.5">
                      <div className="h-4 w-32 bg-secondary/50 rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="h-4 w-24 bg-secondary/50 rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="h-4 w-24 bg-secondary/50 rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="h-4 w-28 bg-secondary/50 rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="h-4 w-20 bg-secondary/50 rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="h-4 w-32 bg-secondary/50 rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="pt-[60px] pb-16 text-center">
                  <ScrollText className="w-12 h-12 text-muted-foreground mx-auto" />
                  <h3 className="text-base font-semibold mt-4">Nenhum log registrado</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Os logs de atividade aparecerão aqui conforme o sistema for utilizado.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const detailsPreview = log.details
                  ? JSON.stringify(log.details).slice(0, 80) +
                    (JSON.stringify(log.details).length > 80 ? '...' : '')
                  : '—'
                return (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className="border-border hover:bg-secondary/50 cursor-pointer px-4 py-2.5"
                      onClick={() => setExpanded((e) => ({ ...e, [log.id]: !e[log.id] }))}
                    >
                      <TableCell className="px-4 py-2.5 text-[13px]">
                        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-[13px] font-medium text-foreground">
                        {log.tenant_name ? (
                          log.tenant_name
                        ) : (
                          <span className="text-muted-foreground font-normal">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-[13px] text-foreground">
                        {log.user_name ? (
                          log.user_name
                        ) : (
                          <span className="italic text-muted-foreground">— Sistema —</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-[13px] font-medium">
                        <span className={getActionColorClass(log.action)}>
                          {formatActionName(log.action)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                        {log.entity_type || '—'}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-[13px]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground truncate max-w-[150px] lg:max-w-[200px]">
                            {detailsPreview}
                          </span>
                          <ChevronDown
                            className={cn(
                              'w-[14px] h-[14px] text-muted-foreground transition-transform duration-200 ml-2 flex-shrink-0',
                              expanded[log.id] && 'rotate-180',
                            )}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded[log.id] && log.details && (
                      <TableRow className="bg-secondary/30 border-b border-border">
                        <TableCell colSpan={6} className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            {Object.entries(flattenObject(log.details)).map(([k, v]) => (
                              <div key={k} className={cn('flex gap-2', k.includes('.') && 'ml-4')}>
                                <span className="text-xs font-semibold text-muted-foreground min-w-[120px]">
                                  {k}:
                                </span>
                                <span
                                  className={cn(
                                    'text-xs text-foreground',
                                    isUUID(v) && 'font-mono text-muted-foreground/80',
                                    isBoolean(v) &&
                                      (v === 'true' ? 'text-success' : 'text-muted-foreground'),
                                    v === 'null' && 'text-muted-foreground',
                                  )}
                                >
                                  {formatValue(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 gap-4">
        <span className="text-[13px] text-muted-foreground">
          Mostrando {total === 0 ? 0 : (page - 1) * 20 + 1} a {Math.min(page * 20, total)} de{' '}
          {total} logs
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
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-2">Total: {total} registros</div>
    </div>
  )
}
