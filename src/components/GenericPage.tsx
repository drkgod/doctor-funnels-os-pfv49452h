export function GenericPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center animate-fade-in">
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-muted-foreground mt-3 text-lg max-w-xl mx-auto">{subtitle}</p>
    </div>
  )
}
