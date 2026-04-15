import { useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Camera } from 'lucide-react'

const roleNames: Record<string, string> = {
  doctor: 'Médico',
  secretary: 'Secretária',
  super_admin: 'Super Admin',
}

export function ProfileTab({ profile, onUpdate }: { profile: any; onUpdate: (data: any) => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'Formato invalido. Use JPG, PNG ou WebP ate 2MB.',
        variant: 'destructive',
      })
      return
    }

    const ext = file.name.split('.').pop()
    const fileName = `${user?.id}/${crypto.randomUUID()}.${ext}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id)

      if (updateError) throw updateError

      onUpdate({ avatar_url: publicUrl })
      toast({ title: 'Sucesso', description: 'Foto atualizada com sucesso.' })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a foto.',
        variant: 'destructive',
      })
    }
  }

  const handleSave = async () => {
    if (!fullName)
      return toast({ title: 'Erro', description: 'O nome é obrigatório.', variant: 'destructive' })
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', user?.id)

      if (error) throw error

      await supabase.auth.updateUser({ data: { full_name: fullName } })

      onUpdate({ full_name: fullName, phone })
      toast({ title: 'Sucesso', description: 'Perfil atualizado com sucesso.' })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getInitials = (name: string) => (name ? name.substring(0, 2).toUpperCase() : 'US')

  return (
    <Card className="p-7 bg-card border-border rounded-xl shadow-sm">
      <h2 className="text-[17px] font-semibold mb-6 pb-4 border-b border-border text-foreground">
        Meu Perfil
      </h2>
      <div className="space-y-6">
        <div className="flex items-center gap-5 mb-7">
          <div className="h-24 w-24 rounded-full overflow-hidden border-[3px] border-border flex items-center justify-center shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-[32px] font-bold text-primary">
                {getInitials(profile.full_name)}
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 text-[13px] gap-1 hover:border-primary hover:text-primary transition-colors"
            >
              <Camera className="w-[14px] h-[14px]" />
              Alterar foto
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
            />
            <p className="text-xs text-muted-foreground">JPG, PNG ou WebP até 2MB.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label
              htmlFor="name"
              className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
            >
              Nome completo
            </Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-[42px] text-[14px] border-border rounded-md"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="email"
              className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
            >
              Email
            </Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              readOnly
              className="h-[42px] text-[14px] border-border rounded-md bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-100"
            />
            <p className="text-[11px] text-muted-foreground italic mt-1">
              Para alterar o email, contate o administrador.
            </p>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="phone"
              className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
            >
              Telefone
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 98765-4321"
              className="h-[42px] text-[14px] border-border rounded-md"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="role"
              className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
            >
              Função
            </Label>
            <Input
              id="role"
              value={roleNames[profile.role] || profile.role}
              disabled
              readOnly
              className="h-[42px] text-[14px] border-border rounded-md bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-100"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-[42px] px-6 font-semibold mt-2"
        >
          {isSaving ? 'Salvando...' : 'Salvar Perfil'}
        </Button>
      </div>
    </Card>
  )
}
