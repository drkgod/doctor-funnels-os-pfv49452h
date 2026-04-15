import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

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
    <Card>
      <CardHeader>
        <CardTitle>Meu Perfil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
          <Avatar className="h-24 w-24 border">
            {profile.avatar_url ? (
              <AvatarImage
                src={profile.avatar_url}
                alt={profile.full_name}
                className="object-cover"
              />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col items-center sm:items-start gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email || ''} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              Para alterar o email, contate o administrador.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Input id="role" value={roleNames[profile.role] || profile.role} disabled readOnly />
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Perfil'}
        </Button>
      </CardContent>
    </Card>
  )
}
