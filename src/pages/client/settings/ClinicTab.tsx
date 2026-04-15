import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

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
  const { toast } = useToast()

  const [clinicName, setClinicName] = useState(tenant?.name || '')
  const [address, setAddress] = useState(tenant?.address || '')
  const [phone, setPhone] = useState(tenant?.phone || '')
  const [hours, setHours] = useState<any>(tenant?.business_hours || defaultHours)
  const [isSaving, setIsSaving] = useState(false)

  if (!tenant) {
    return (
      <Card className="p-7 bg-card border-border rounded-xl shadow-sm">
        Você não está vinculado a uma clínica.
      </Card>
    )
  }

  const isDoctor = profile?.role === 'doctor' || profile?.role === 'super_admin'

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
      toast({ title: 'Sucesso', description: 'Dados da clínica atualizados.' })
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
    <Card className="p-7 bg-card border-border rounded-xl shadow-sm">
      <h2 className="text-[17px] font-semibold mb-6 pb-4 border-b border-border text-foreground">
        Dados da Clínica
      </h2>
      <div className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label
              htmlFor="clinicName"
              className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
            >
              Nome da clínica
            </Label>
            <Input
              id="clinicName"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              disabled={!isDoctor}
              className={cn(
                'h-[42px] text-[14px] border-border rounded-md',
                !isDoctor &&
                  'bg-secondary/50 text-muted-foreground cursor-not-allowed disabled:opacity-100',
              )}
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="clinicAddress"
              className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
            >
              Endereço
            </Label>
            <Input
              id="clinicAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-[42px] text-[14px] border-border rounded-md"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label
              htmlFor="clinicPhone"
              className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.3px]"
            >
              Telefone da clínica
            </Label>
            <Input
              id="clinicPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-[42px] text-[14px] border-border rounded-md"
            />
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-border">
          <h3 className="text-[14px] font-semibold mb-4">Horário de Funcionamento</h3>
          <div className="flex flex-col">
            {daysOfWeek.map((day, index) => {
              const dayData = hours[day.key] || defaultHours[day.key as keyof typeof defaultHours]
              const isLast = index === daysOfWeek.length - 1
              return (
                <div
                  key={day.key}
                  className={cn(
                    'flex flex-col sm:grid sm:grid-cols-[140px_48px_1fr_24px_1fr] sm:items-center gap-3 py-2.5',
                    !isLast && 'border-b border-border/30',
                    !dayData.open && 'opacity-50 transition-opacity',
                  )}
                >
                  <div className="flex items-center gap-3 sm:contents">
                    <span className="text-[14px] font-medium w-[120px] sm:w-auto">{day.label}</span>
                    <Switch
                      checked={dayData.open}
                      onCheckedChange={(v) => updateHour(day.key, 'open', v)}
                    />
                  </div>
                  <div className="flex items-center gap-3 pl-[132px] sm:pl-0 sm:contents">
                    <Input
                      type="time"
                      value={dayData.start}
                      disabled={!dayData.open}
                      onChange={(e) => updateHour(day.key, 'start', e.target.value)}
                      className="h-[38px] text-[13px] font-mono w-[100px] border-border disabled:opacity-100"
                    />
                    <span className="text-[12px] text-muted-foreground text-center">até</span>
                    <Input
                      type="time"
                      value={dayData.end}
                      disabled={!dayData.open}
                      onChange={(e) => updateHour(day.key, 'end', e.target.value)}
                      className="h-[38px] text-[13px] font-mono w-[100px] border-border disabled:opacity-100"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="h-[42px] px-6 font-semibold mt-2"
        >
          {isSaving ? 'Salvando...' : 'Salvar Dados da Clínica'}
        </Button>
      </div>
    </Card>
  )
}
