import { Skeleton } from '@/components/ui/skeleton'

export function LoadingScreen() {
  return (
    <div className="p-6 space-y-6 w-full animate-pulse" role="status" aria-label="Carregando...">
      <span className="sr-only">Carregando...</span>
      <Skeleton className="h-10 w-[250px] mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl mt-6" />
    </div>
  )
}
