import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: ReactNode
  valueClass?: string
}

export function StatCard({ label, value, subtext, valueClass = 'text-foreground' }: StatCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string' && val.endsWith('%')) {
      return (
        <>
          {val.slice(0, -1)}
          <span className="text-[16px] font-medium">%</span>
        </>
      )
    }
    return val
  }

  return (
    <div className="p-5 bg-card border border-border rounded-md transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] print:shadow-none print:border-none">
      <div className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.3px]">
        {label}
      </div>
      <div className={cn('text-[26px] font-bold mt-1.5', valueClass)}>{formatValue(value)}</div>
      {subtext && <div className="text-[12px] text-muted-foreground mt-1">{subtext}</div>}
    </div>
  )
}
