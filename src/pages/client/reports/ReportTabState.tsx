import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ReactNode } from 'react'

export function ReportTabState({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean
  error: boolean
  empty: boolean
  onRetry: () => void
  children: ReactNode
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="text-center py-12 border rounded-lg bg-card">
        <p className="text-destructive mb-4">
          Nao foi possivel carregar os relatorios. Tente novamente.
        </p>
        <Button onClick={onRetry} variant="outline">
          Tentar novamente
        </Button>
      </div>
    )
  }
  if (empty) {
    return (
      <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground">
        Nenhum dado encontrado para o periodo selecionado. Tente ampliar o intervalo de datas.
      </div>
    )
  }
  return <>{children}</>
}
