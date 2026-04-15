import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Search,
  MoreVertical,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { tenantService } from '@/services/tenantService'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getPlanBadgeClasses, getStatusBadgeClasses } from './AdminDashboard'

type TenantState = 'loading' | 'empty' | 'error' | 'success'

export default function Tenants() {
  const [state, setState] = useState<TenantState>('loading')
  const [tenants, setTenants] = useState<any[]>([])
  const [plan, setPlan] = useState('Todos os planos')
  const [status, setStatus] = useState('Todos os status')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [isNewOpen, setIsNewOpen] = useState(false)
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', plan: 'essential' })
  const [isCreating, setIsCreating] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadTenants = async () => {
    setState('loading')
    try {
      const { data } = await tenantService.fetchTenants({
        plan: plan !== 'Todos os planos' ? plan.toLowerCase() : undefined,
        status: status !== 'Todos os status' ? status.toLowerCase() : undefined,
        search: search || undefined,
      })
      setTenants(data || [])
      setState(data && data.length > 0 ? 'success' : 'empty')
      setCurrentPage(1)
    } catch (error) {
      setState('error')
      toast.error('Erro ao carregar tenants')
    }
  }

  useEffect(() => {
    loadTenants()
  }, [plan, status, search])

  const handleCreate = async () => {
    if (!newTenant.name || !newTenant.slug) return
    setIsCreating(true)
    try {
      await tenantService.createTenant(newTenant.name, newTenant.slug, newTenant.plan)
      toast.success('Tenant criado com sucesso')
      setIsNewOpen(false)
      setNewTenant({ name: '', slug: '', plan: 'essential' })
      loadTenants()
    } catch (error) {
      toast.error('Erro ao criar tenant')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await tenantService.deleteTenant(deleteId)
      toast.success('Tenant excluído')
      setDeleteId(null)
      loadTenants()
    } catch (error) {
      toast.error('Erro ao excluir tenant')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleStatus = async (tenant: any) => {
    try {
      const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
      await tenantService.updateTenant(tenant.id, { status: newStatus })
      toast.success('Status atualizado')
      loadTenants()
    } catch (error) {
      toast.error('Erro ao atualizar status')
    }
  }

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return tenants.slice(start, start + itemsPerPage)
  }, [tenants, currentPage])

  const totalPages = Math.ceil(tenants.length / itemsPerPage)

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-10 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Tenants</h1>
        <p className="text-muted-foreground mt-2">Administração de clínicas e assinaturas</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full md:w-auto md:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar clinica..."
              className="h-10 w-full bg-input border border-border rounded-[var(--radius)] pl-9 pr-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-ring"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="h-10 min-w-[160px] bg-input border border-border rounded-[var(--radius)] text-[14px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos os planos">Todos os planos</SelectItem>
              <SelectItem value="Essential">Essential</SelectItem>
              <SelectItem value="Professional">Professional</SelectItem>
              <SelectItem value="Clinic">Clinic</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 min-w-[160px] bg-input border border-border rounded-[var(--radius)] text-[14px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos os status">Todos os status</SelectItem>
              <SelectItem value="Active">Ativo</SelectItem>
              <SelectItem value="Trial">Trial</SelectItem>
              <SelectItem value="Suspended">Suspenso</SelectItem>
              <SelectItem value="Cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="h-10 px-4 font-semibold text-[14px] bg-primary text-primary-foreground rounded-[var(--radius)] hover:bg-primary/90 transition-colors w-full sm:w-auto whitespace-nowrap"
        >
          Novo Tenant
        </button>
      </div>

      {state === 'loading' && (
        <div className="flex flex-col gap-3">
          <div className="h-12 w-full shimmer-card" />
          <div className="h-16 w-full shimmer-card" />
          <div className="h-16 w-full shimmer-card" />
          <div className="h-16 w-full shimmer-card" />
          <div className="h-16 w-full shimmer-card" />
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-[18px] font-semibold">Erro ao carregar tenants</h3>
          <Button variant="outline" onClick={loadTenants} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      )}

      {state === 'empty' &&
        !search &&
        plan === 'Todos os planos' &&
        status === 'Todos os status' && (
          <div className="flex flex-col items-center justify-center max-w-[320px] mx-auto pt-20 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground" />
            <h3 className="text-[18px] font-semibold mt-4">Nenhum tenant cadastrado</h3>
            <p className="text-[14px] text-muted-foreground mt-2">
              Crie o primeiro tenant para comecar.
            </p>
            <button
              onClick={() => setIsNewOpen(true)}
              className="mt-6 h-10 px-4 font-semibold text-[14px] bg-primary text-primary-foreground rounded-[var(--radius)] hover:bg-primary/90 transition-colors"
            >
              Criar Tenant
            </button>
          </div>
        )}

      {state === 'empty' &&
        (search || plan !== 'Todos os planos' || status !== 'Todos os status') && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[14px] text-muted-foreground">
              Nenhum tenant encontrado para os filtros atuais.
            </p>
          </div>
        )}

      {state === 'success' && (
        <div className="flex flex-col">
          <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                    <th className="px-4 py-3 whitespace-nowrap">Nome</th>
                    <th className="px-4 py-3 whitespace-nowrap">Plano</th>
                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap">Módulos Ativos</th>
                    <th className="px-4 py-3 whitespace-nowrap">Criado em</th>
                    <th className="px-4 py-3 w-[60px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((tenant) => {
                    const activeCount =
                      tenant.tenant_modules?.filter((m: any) => m.is_enabled).length || 0
                    return (
                      <tr
                        key={tenant.id}
                        className="border-b border-border hover:bg-secondary/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                          <Link
                            to={`/admin/tenants/${tenant.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {tenant.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                          <span
                            className={cn(
                              'text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block capitalize',
                              getPlanBadgeClasses(tenant.plan),
                            )}
                          >
                            {tenant.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                          <span
                            className={cn(
                              'text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block capitalize',
                              getStatusBadgeClasses(tenant.status),
                            )}
                          >
                            {tenant.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[14px] whitespace-nowrap">
                          <span
                            className={cn(
                              'font-medium',
                              activeCount === 8
                                ? 'text-success'
                                : activeCount === 0
                                  ? 'text-muted-foreground'
                                  : 'text-foreground',
                            )}
                          >
                            {activeCount}/8
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[14px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(tenant.created_at), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-8 w-8 inline-flex items-center justify-center rounded-[var(--radius)] hover:bg-secondary text-muted-foreground transition-colors ghost-style">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-[160px] bg-card border shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-[var(--radius)]"
                            >
                              <DropdownMenuItem
                                asChild
                                className="px-3 py-2 text-[13px] hover:bg-secondary cursor-pointer rounded-[calc(var(--radius)-2px)] focus:bg-secondary"
                              >
                                <Link to={`/admin/tenants/${tenant.id}`}>Editar</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleStatus(tenant)}
                                className="px-3 py-2 text-[13px] hover:bg-secondary cursor-pointer rounded-[calc(var(--radius)-2px)] focus:bg-secondary"
                              >
                                {tenant.status === 'active' ? 'Suspender' : 'Ativar'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteId(tenant.id)}
                                className="px-3 py-2 text-[13px] hover:bg-secondary text-destructive focus:text-destructive cursor-pointer rounded-[calc(var(--radius)-2px)] focus:bg-secondary"
                              >
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center py-3 flex-wrap gap-4">
            <span className="text-[13px] text-muted-foreground">
              Mostrando {(currentPage - 1) * itemsPerPage + (tenants.length > 0 ? 1 : 0)} a{' '}
              {Math.min(currentPage * itemsPerPage, tenants.length)} de {tenants.length} tenants
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 w-8 rounded-[var(--radius)] flex items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-50 ghost-style"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'h-8 w-8 rounded-[var(--radius)] text-[13px] flex items-center justify-center transition-colors',
                    currentPage === page
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary text-foreground ghost-style',
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 w-8 rounded-[var(--radius)] flex items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-50 ghost-style"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Novo Tenant</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">Nome da clínica</Label>
              <input
                className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
                value={newTenant.name}
                onChange={(e) =>
                  setNewTenant({
                    ...newTenant,
                    name: e.target.value,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      .replace(/[^a-z0-9-]/g, ''),
                  })
                }
              />
            </div>
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">Slug (URL)</Label>
              <input
                className="w-full h-10 px-3 text-[13px] font-mono text-muted-foreground bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-1 focus:ring-ring"
                value={newTenant.slug}
                onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <Label className="block text-[13px] font-medium mb-1">Plano</Label>
              <Select
                value={newTenant.plan}
                onValueChange={(val) => setNewTenant({ ...newTenant, plan: val })}
              >
                <SelectTrigger className="h-10 text-[14px] rounded-[var(--radius)] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[var(--radius)]">
                  <SelectItem value="essential">Essential</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setIsNewOpen(false)}
              className="h-10 px-4 rounded-[var(--radius)] border border-border text-[14px] font-medium hover:bg-secondary transition-colors outline-style"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !newTenant.name}
              className="h-10 px-4 rounded-[var(--radius)] bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isCreating ? 'Criando...' : 'Criar Tenant'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-[var(--radius)]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Excluir tenant</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-[14px] leading-[1.6] text-muted-foreground">
              Tem certeza que deseja excluir? Todos os dados serão perdidos permanentemente.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setDeleteId(null)}
              className="h-10 px-4 rounded-[var(--radius)] border border-border text-[14px] font-medium hover:bg-secondary transition-colors outline-style"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-10 px-4 rounded-[var(--radius)] bg-destructive text-white text-[14px] font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
