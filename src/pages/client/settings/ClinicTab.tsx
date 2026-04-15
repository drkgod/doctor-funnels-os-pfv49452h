import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'

const daysOfWeek = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
]

const defaultHours = {
  monday: { open: true, start: '08:00', end: '18:00' },
  tuesday: { open: true, start: '08:00', end: '18:00' },
  wednesday: { open: true, start: '08:00', end: '18:00' },
  thursday: { open: true, start: '08:00', end: '18:00' },
  friday: { open: true, start: '08:00', end: '18:00' },
  saturday: { open: false, start: '08:00', end: '18:00' },
  sunday: { open: false, start: '08:00', end: '18:00' },
}

export function ClinicTab({
  tenant,
  profile,
  onUpdate,
}: {
  tenant: any
  profile: any
  onUpdate: (data: any) => void
}) {
  if (!tenant) {
    return (
      <Card>
        <CardContent className="pt-6">Voce nao esta vinculado a uma clinica.</CardContent>
      </Card>
    )
  }

  const { toast } = useToast()
  const isDoctor = profile.role === 'doctor' || profile.role === 'super_admin'

  const [clinicName, setClinicName] = useState(tenant.name || '')
  const [address, setAddress] = useState(tenant.address || '')
  const [phone, setPhone] = useState(tenant.phone || '')
  const [hours, setHours] = useState<any>(tenant.business_hours || defaultHours)
  const [isSaving, setIsSaving] = useState(false)

  const updateHour = (day: string, field: string, value: any) => {
    setHours((prev: any) => ({
      ...prev,
      [day]: { ...(prev[day] || defaultHours[day as keyof typeof defaultHours]), [field]: value },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updateData: any = { address, phone, business_hours: hours }
      if (isDoctor) updateData.name = clinicName

      const { error } = await supabase.from('tenants').update(updateData).eq('id', tenant.id)
      if (error) throw error

      onUpdate(updateData)
      toast({ title: 'Sucesso', description: 'Dados da clinica atualizados.' })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar os dados da clínica.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da Clinica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clinicName">Nome da clinica</Label>
            <Input
              id="clinicName"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              disabled={!isDoctor}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinicAddress">Endereco</Label>
            <Input
              id="clinicAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="clinicPhone">Telefone da clinica</Label>
            <Input id="clinicPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Horario de Funcionamento</h3>
          <div className="border rounded-md divide-y">
            {daysOfWeek.map((day) => {
              const dayData = hours[day.key] || defaultHours[day.key as keyof typeof defaultHours]
              return (
                <div
                  key={day.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4"
                >
                  <div className="flex items-center gap-4 w-32">
                    <Switch
                      checked={dayData.open}
                      onCheckedChange={(v) => updateHour(day.key, 'open', v)}
                    />
                    <span className="text-sm font-medium">{day.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayData.start}
                      disabled={!dayData.open}
                      onChange={(e) => updateHour(day.key, 'start', e.target.value)}
                      className="w-28 text-muted-foreground disabled:opacity-50"
                    />
                    <span className="text-muted-foreground text-sm">ate</span>
                    <Input
                      type="time"
                      value={dayData.end}
                      disabled={!dayData.open}
                      onChange={(e) => updateHour(day.key, 'end', e.target.value)}
                      className="w-28 text-muted-foreground disabled:opacity-50"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Dados da Clinica'}
        </Button>
      </CardContent>
    </Card>
  )
}
