import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { tenantService } from '@/services/tenantService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const moduleNames: Record<string, string> = {
  crm: 'CRM',
  whatsapp: 'WhatsApp',
  email: 'Email',
  agenda: 'Agenda',
  dashboard: 'Dashboard',
  templates: 'Templates',
  automations: 'Automações',
  ai_chatbot: 'Chatbot IA',
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
    <div className="mt-3">
      <Label className="text-xs text-muted-foreground">{limitKey}</Label>
      <Input
        type="number"
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="h-8 mt-1"
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
  const [unassigned, setUnassigned] = useState<any[]>([])

  const loadData = async () => {
    try {
      const res = await tenantService.fetchTenantById(id!)
      setData(res)
      setEditData(res.tenant)
    } catch (e) {
      toast.error('Erro ao carregar')
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
        console.error('Error searching users', e)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch, userOpen])

  if (loading)
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  if (!data)
    return (
      <div className="p-8 text-center text-destructive">
        Erro ao carregar. <Button onClick={loadData}>Tentar novamente</Button>
      </div>
    )

  const { tenant, modules, apiKeys, users } = data
  const wappKey = apiKeys.find((k: any) => k.provider === 'uazapi')
  const otherKeys = apiKeys.filter((k: any) => k.provider !== 'uazapi')

  const handleUpdate = async () => {
    try {
      await tenantService.updateTenant(id!, {
        name: editData.name,
        plan: editData.plan,
        status: editData.status,
        address: editData.address,
        phone: editData.phone,
      })
      toast.success('Atualizado')
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
      toast.error('Erro')
    }
  }

  const updateLimit = async (modKey: string, limitKey: string, val: number) => {
    try {
      const mod = modules.find((m: any) => m.module_key === modKey)
      await tenantService.updateModuleLimits(id!, modKey, { ...mod.limits, [limitKey]: val })
      toast.success('Limite atualizado')
      loadData()
    } catch (e) {
      toast.error('Erro')
    }
  }

  const createInstance = async () => {
    toast.info('Criando instância, aguarde...')
    try {
      await tenantService.createWhatsappInstance(id!)
      toast.success('Instância criada!')
      loadData()
    } catch (e) {
      toast.error('Erro ao criar')
    }
  }

  const removeKey = async (keyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta integração?')) return
    try {
      await tenantService.removeApiKey(keyId)
      toast.success('Removida')
      loadData()
    } catch (e) {
      toast.error('Erro')
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full pb-10 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/tenants">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
          <p className="text-muted-foreground">{tenant.slug}</p>
        </div>
      </div>

      {/* Informacoes */}
      <Card>
        <CardHeader className="flex flex-row justify-between">
          <CardTitle>Informações</CardTitle>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano</p>
            <Badge>{tenant.plan}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant="outline">{tenant.status}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Telefone</p>
            <p>{tenant.phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Endereço</p>
            <p>{tenant.address || '-'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Módulos */}
      <Card>
        <CardHeader>
          <CardTitle>Módulos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {modules.map((m: any) => (
            <Card key={m.id} className="p-4 shadow-none">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{moduleNames[m.module_key] || m.module_key}</span>
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
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          {!wappKey ? (
            <div className="text-center py-4 border rounded-lg border-dashed">
              <p className="text-muted-foreground mb-4">
                Crie uma instância para este tenant se conectar ao WhatsApp.
              </p>
              <Button onClick={createInstance}>Criar Instância</Button>
            </div>
          ) : (
            <div className="flex justify-between items-center border p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge>{wappKey.metadata?.instance_status}</Badge>
                  <span className="font-medium">
                    {wappKey.metadata?.phone_number || 'Nenhum número conectado'}
                  </span>
                </div>
                <div className="text-sm flex items-center gap-2 text-muted-foreground">
                  {wappKey.metadata?.webhook_configured ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-success" /> Webhook configurado
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-warning" /> Webhook pendente
                    </>
                  )}
                </div>
              </div>
              <Button variant="destructive" onClick={() => removeKey(wappKey.id)}>
                Remover Instância
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrações */}
      <Card>
        <CardHeader className="flex flex-row justify-between">
          <CardTitle>Integrações</CardTitle>
          <Button onClick={() => setIntOpen(true)}>Adicionar Integração</Button>
        </CardHeader>
        <CardContent>
          {otherKeys.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma integração</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {otherKeys.map((k: any) => (
                <div key={k.id} className="border p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-medium capitalize">{k.provider}</p>
                    <Badge variant="outline">{k.status}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeKey(k.id)}
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usuarios */}
      <Card>
        <CardHeader className="flex flex-row justify-between">
          <CardTitle>Usuários</CardTitle>
          <Button onClick={() => setUserOpen(true)}>Vincular Usuário</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{u.role === 'doctor' ? 'Médico' : 'Secretária'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        if (confirm('Remover?')) {
                          await tenantService.removeUserFromTenant(u.id)
                          loadData()
                        }
                      }}
                    >
                      Desvincular
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Informações</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={editData.address || ''}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Integration Dialog */}
      <Dialog open={intOpen} onOpenChange={setIntOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Integração</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select
                value={newInt.provider}
                onValueChange={(v) => setNewInt({ ...newInt, provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="google_calendar">Google Calendar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                value={newInt.key}
                onChange={(e) => setNewInt({ ...newInt, key: e.target.value })}
                type="password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await tenantService.addApiKey(id!, newInt.provider, newInt.key)
                  toast.success('Adicionada')
                  setIntOpen(false)
                  loadData()
                } catch (e) {
                  toast.error('Erro')
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Buscar por nome..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {unassigned.map((u) => (
                <div key={u.id} className="flex justify-between items-center p-2 border rounded">
                  <span>{u.full_name}</span>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await tenantService.assignUserToTenant(u.id, id!)
                      toast.success('Vinculado')
                      loadData()
                      setUnassigned(unassigned.filter((x) => x.id !== u.id))
                    }}
                  >
                    Vincular
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
