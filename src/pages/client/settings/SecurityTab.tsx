import { useState } from 'react'
import { Card } from '@/components/ui/card'
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
import { Monitor, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SecurityTab() {
  const { user, session } = useAuth()
  const { toast } = useToast()

  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [isChangingPass, setIsChangingPass] = useState(false)

  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '', textColor: '' }
    let score = 0
    if (pass.length >= 6) score += 1
    if (pass.length >= 8) score += 1
    if (/[A-Z]/.test(pass)) score += 1
    if (/[0-9!@#$%^&*]/.test(pass)) score += 1

    if (score <= 1)
      return { score: 1, label: 'Muito fraca', color: 'bg-red-500', textColor: 'text-red-500' }
    if (score === 2)
      return { score: 2, label: 'Fraca', color: 'bg-amber-500', textColor: 'text-amber-500' }
    if (score === 3)
      return { score: 3, label: 'Média', color: 'bg-primary', textColor: 'text-primary' }
    return { score: 4, label: 'Forte', color: 'bg-green-500', textColor: 'text-green-500' }
  }

  const strength = getPasswordStrength(newPass)

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
    <Card className="p-7 bg-card border-border rounded-xl shadow-sm">
      <h2 className="text-[17px] font-semibold mb-6 pb-4 border-b border-border text-foreground">
        Segurança
      </h2>
      <div className="space-y-0">
        {/* Alterar Senha */}
        <div className="pb-7">
          <h3 className="text-[15px] font-semibold mb-4">Alterar Senha</h3>
          <div className="flex flex-col gap-5 max-w-[400px]">
            <div className="space-y-1">
              <Label
                htmlFor="currentPass"
                className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
              >
                Senha atual
              </Label>
              <Input
                id="currentPass"
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                required
                className="h-[42px] text-[14px] border-border rounded-md"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="newPass"
                className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
              >
                Nova senha
              </Label>
              <Input
                id="newPass"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
                className="h-[42px] text-[14px] border-border rounded-md"
              />
              {newPass && (
                <div className="mt-2">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        className={cn(
                          'h-2 flex-1 rounded-[2px] transition-colors duration-300',
                          s <= strength.score ? strength.color : 'bg-secondary',
                        )}
                      />
                    ))}
                  </div>
                  <div className={cn('text-[11px] font-medium', strength.textColor)}>
                    {strength.label}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                A senha deve ter pelo menos 6 caracteres.
              </p>
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="confirmPass"
                className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
              >
                Confirmar nova senha
              </Label>
              <Input
                id="confirmPass"
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                required
                className="h-[42px] text-[14px] border-border rounded-md"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleChangePassword}
              disabled={isChangingPass}
              className="h-[42px] font-semibold mt-2"
            >
              {isChangingPass ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </div>
        </div>

        {/* Sessões Ativas */}
        <div className="pt-6 border-t border-border mt-7">
          <h3 className="text-[15px] font-semibold mb-4">Sessões Ativas</h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <p className="text-[13px]">
                Você está logado desde <span className="font-medium">{formattedDate}</span>
              </p>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-[42px] font-medium border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Sair de todos os dispositivos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Encerrar sessões</DialogTitle>
                  <DialogDescription>
                    Isso encerrará todas as suas sessões ativas. Você precisará fazer login
                    novamente.
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
        </div>

        {/* Excluir Conta */}
        <div className="pt-6 border-t border-border mt-7">
          <h3 className="text-[15px] font-semibold mb-4 text-destructive">Excluir Conta</h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-[13px] text-destructive/80 leading-[1.6] px-4 py-3 bg-destructive/5 rounded-md border border-destructive/20 max-w-[600px]">
              Ao excluir sua conta, todos os seus dados serão perdidos permanentemente. Esta ação
              não pode ser desfeita.
            </p>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-[42px] text-destructive hover:bg-destructive/10 hover:text-destructive font-medium shrink-0"
                >
                  Excluir minha conta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[440px] text-center p-7">
                <div className="flex justify-center mb-4">
                  <Shield className="w-10 h-10 text-destructive" />
                </div>
                <DialogHeader>
                  <DialogTitle className="text-[18px] font-bold text-center">
                    Excluir conta permanentemente
                  </DialogTitle>
                  <DialogDescription className="text-[14px] text-muted-foreground mt-2 text-center">
                    Digite 'EXCLUIR' para confirmar:
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                  className="h-[42px] text-center text-[16px] tracking-[2px] mt-4 placeholder:text-muted/30 uppercase"
                />
                <DialogFooter className="mt-3">
                  <Button
                    variant="destructive"
                    disabled={deleteConfirmText !== 'EXCLUIR' || isDeleting}
                    onClick={handleDeleteAccount}
                    className="w-full h-[44px] font-semibold disabled:opacity-50"
                  >
                    {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Card>
  )
}
