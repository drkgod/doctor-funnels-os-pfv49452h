import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

export function SecurityTab() {
  const { user, session } = useAuth()
  const { toast } = useToast()

  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [isChangingPass, setIsChangingPass] = useState(false)

  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleChangePassword = async () => {
    if (!currentPass)
      return toast({ title: 'Erro', description: 'Digite sua senha atual', variant: 'destructive' })
    if (newPass.length < 6)
      return toast({
        title: 'Erro',
        description: 'A nova senha deve ter pelo menos 6 caracteres',
        variant: 'destructive',
      })
    if (newPass !== confirmPass)
      return toast({
        title: 'Erro',
        description: 'As senhas nao coincidem',
        variant: 'destructive',
      })

    setIsChangingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) {
        if (error.message.includes('different from the old password')) {
          throw new Error('A nova senha deve ser diferente da atual.')
        }
        throw error
      }
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' })
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível alterar a senha.',
        variant: 'destructive',
      })
    } finally {
      setIsChangingPass(false)
    }
  }

  const handleGlobalLogout = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    toast({ title: 'Sucesso', description: 'Todas as sessoes foram encerradas.' })
    window.location.href = '/login'
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'EXCLUIR') return
    setIsDeleting(true)
    try {
      await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', user?.id)
      await supabase.auth.signOut()
      toast({ title: 'Sucesso', description: 'Conta excluida.' })
      window.location.href = '/login'
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir conta.', variant: 'destructive' })
      setIsDeleting(false)
    }
  }

  const sessionDate = session?.user?.last_sign_in_at || session?.user?.created_at
  const formattedDate = sessionDate
    ? new Date(sessionDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'agora'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguranca</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Alterar Senha</h3>
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="currentPass">Senha atual</Label>
              <Input
                id="currentPass"
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPass">Nova senha</Label>
              <Input
                id="newPass"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPass">Confirmar nova senha</Label>
              <Input
                id="confirmPass"
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                required
              />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={isChangingPass}>
            {isChangingPass ? 'Alterando...' : 'Alterar Senha'}
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Sessoes Ativas</h3>
          <p className="text-sm text-muted-foreground">Voce esta logado desde {formattedDate}</p>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Sair de todos os dispositivos</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Encerrar sessões</DialogTitle>
                <DialogDescription>
                  Isso encerrara todas as suas sessoes ativas. Voce precisara fazer login novamente.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={handleGlobalLogout}>
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-destructive">Excluir Conta</h3>
          <p className="text-sm text-muted-foreground">
            Ao excluir sua conta, todos os seus dados serao perdidos permanentemente. Esta acao nao
            pode ser desfeita.
          </p>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Excluir minha conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir conta permanentemente</DialogTitle>
                <DialogDescription>Digite 'EXCLUIR' para confirmar:</DialogDescription>
              </DialogHeader>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="EXCLUIR"
              />
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={deleteConfirmText !== 'EXCLUIR' || isDeleting}
                  onClick={handleDeleteAccount}
                >
                  {isDeleting ? 'Excluindo...' : 'Confirmar Exclusao'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
