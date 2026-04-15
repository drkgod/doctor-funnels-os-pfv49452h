import { Lock } from 'lucide-react'
import { useModuleAccess } from '@/hooks/useModuleAccess'
import { Skeleton } from '@/components/ui/skeleton'

export function ModuleGate({
  module_key,
  children,
}: {
  module_key: string
  children: React.ReactNode
}) {
  const { isEnabled, isLoading } = useModuleAccess(module_key)

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-[1600px] mx-auto">
        <Skeleton className="h-12 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-[1600px] mx-auto">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Módulo não disponível</h2>
        <p className="text-muted-foreground max-w-md">
          Este módulo não está habilitado para sua clínica. Entre em contato com o administrador.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
