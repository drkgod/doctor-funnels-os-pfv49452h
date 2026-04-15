import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function GenericPage({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col animate-fade-in w-full',
        !children && 'items-center justify-center min-h-[calc(100vh-10rem)] text-center',
      )}
    >
      <div className={cn('mb-8', !children && 'mb-0')}>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className={cn('text-muted-foreground mt-3 text-lg max-w-xl', !children && 'mx-auto')}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
