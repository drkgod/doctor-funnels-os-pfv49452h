import { ReactNode } from 'react'
import { BarChart3, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReportTabStateProps {
  loading: boolean
  error: boolean
  empty: boolean
  onRetry: () => void
  children: ReactNode
  skeletonCards?: number
  hasChart?: boolean
  hasFunnel?: boolean
}

export function ReportTabState({
  loading,
  error,
  empty,
  onRetry,
  children,
  skeletonCards = 4,
  hasChart = true,
  hasFunnel = false,
}: ReportTabStateProps) {
  if (loading) {
    return (
      <div className="animate-in fade-in duration-500">
        <style>{`
          @keyframes custom-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .animate-custom-shimmer {
            animation: custom-shimmer 1.5s infinite linear;
            background: linear-gradient(90deg, hsl(var(--secondary) / 0.5) 0%, hsl(var(--secondary) / 0.8) 50%, hsl(var(--secondary) / 0.5) 100%);
            background-size: 200% 100%;
          }
        `}</style>
        {hasFunnel && (
          <div className="bg-card border border-border rounded-md p-7 mb-7">
            <div className="flex flex-col md:flex-row items-center justify-center gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 w-full md:w-32 rounded-lg animate-custom-shimmer" />
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-7">
          {[...Array(skeletonCards)].map((_, i) => (
            <div key={i} className="h-[120px] rounded-md animate-custom-shimmer" />
          ))}
        </div>
        {hasChart && <div className="h-[260px] w-full rounded-md animate-custom-shimmer" />}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center pt-[60px] pb-10">
        <BarChart3 className="w-12 h-12 text-destructive/40" />
        <h3 className="text-[16px] font-semibold mt-4">
          Nao foi possivel carregar os relatorios. Tente novamente.
        </h3>
        <Button onClick={onRetry} variant="outline" className="mt-6">
          <RefreshCcw className="w-4 h-4 mr-2" /> Tentar novamente
        </Button>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center pt-[60px] pb-10">
        <BarChart3 className="w-12 h-12 text-muted-foreground/40" />
        <h3 className="text-[16px] font-semibold mt-4">Nenhum dado no periodo</h3>
        <p className="text-[14px] text-muted-foreground mt-2 leading-[1.6] max-w-md text-center">
          Tente ampliar o intervalo de datas ou aguarde novos registros.
        </p>
      </div>
    )
  }

  return (
    <div className="print:bg-white print:text-black">
      <style>{`
        @media print {
          body { background-color: white !important; }
          .print\\:hidden { display: none !important; }
          .recharts-wrapper { background: white !important; }
          .print\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .print\\:border-none { border: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
        }
      `}</style>
      {children}
    </div>
  )
}
