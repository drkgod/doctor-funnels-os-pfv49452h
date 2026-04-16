import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Undo, Trash2, MousePointerClick, Loader2, ZoomOut, Pencil } from 'lucide-react'
import { bodyMapService, BodyMapPoint } from '@/services/bodyMapService'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const MAP_TYPES: Record<string, string> = {
  body_front: 'Corpo - Frente',
  body_back: 'Corpo - Costas',
  face_front: 'Face - Frente',
  face_left: 'Face - Esquerda',
  face_right: 'Face - Direita',
  hands: 'Mãos',
  feet: 'Pés',
}

const SVG_PATHS: Record<string, { viewBox: string; path: string }> = {
  body_front: {
    viewBox: '0 0 200 500',
    path: 'M 100 20 C 115 20, 120 35, 120 50 C 120 65, 110 75, 105 80 L 105 90 C 115 90, 130 95, 140 100 L 145 150 L 140 250 L 130 250 L 130 140 L 125 150 L 125 240 L 105 250 L 105 450 L 95 450 L 95 250 L 75 240 L 75 150 L 70 140 L 70 250 L 60 250 L 55 150 L 60 100 C 70 95, 85 90, 95 90 L 95 80 C 90 75, 80 65, 80 50 C 80 35, 85 20, 100 20 Z',
  },
  body_back: {
    viewBox: '0 0 200 500',
    path: 'M 100 20 C 115 20, 120 35, 120 50 C 120 65, 110 75, 105 80 L 105 90 C 115 90, 130 95, 140 100 L 145 150 L 140 250 L 130 250 L 130 140 L 125 150 L 125 240 L 105 250 L 105 450 L 95 450 L 95 250 L 75 240 L 75 150 L 70 140 L 70 250 L 60 250 L 55 150 L 60 100 C 70 95, 85 90, 95 90 L 95 80 C 90 75, 80 65, 80 50 C 80 35, 85 20, 100 20 Z M 90 120 C 95 130, 95 140, 90 150 M 110 120 C 105 130, 105 140, 110 150',
  },
  face_front: {
    viewBox: '0 0 200 250',
    path: 'M 100 20 C 140 20, 160 60, 160 100 C 160 150, 130 190, 100 210 C 70 190, 40 150, 40 100 C 40 60, 60 20, 100 20 Z M 70 100 C 75 95, 85 95, 90 100 M 110 100 C 115 95, 125 95, 130 100 M 100 130 L 100 150 M 85 170 C 95 175, 105 175, 115 170',
  },
  face_left: {
    viewBox: '0 0 200 250',
    path: 'M 120 20 C 160 30, 160 80, 150 120 C 140 160, 130 180, 120 210 C 100 210, 80 190, 80 170 C 80 160, 90 150, 90 140 C 90 130, 70 120, 60 100 C 50 80, 70 40, 120 20 Z',
  },
  face_right: {
    viewBox: '0 0 200 250',
    path: 'M 80 20 C 40 30, 40 80, 50 120 C 60 160, 70 180, 80 210 C 100 210, 120 190, 120 170 C 120 160, 110 150, 110 140 C 110 130, 130 120, 140 100 C 150 80, 130 40, 80 20 Z',
  },
  hands: {
    viewBox: '0 0 300 200',
    path: 'M 100 180 L 90 120 L 70 60 L 80 50 L 95 100 L 100 40 L 115 35 L 120 100 L 130 35 L 145 40 L 140 100 L 155 60 L 165 70 L 140 130 L 140 180 Z M 200 180 L 210 120 L 230 60 L 220 50 L 205 100 L 200 40 L 185 35 L 180 100 L 170 35 L 155 40 L 160 100 L 145 60 L 135 70 L 160 130 L 160 180 Z',
  },
  feet: {
    viewBox: '0 0 300 200',
    path: 'M 100 180 C 70 180, 60 150, 60 100 C 60 60, 70 40, 80 30 C 90 20, 100 20, 110 30 C 130 50, 140 80, 140 120 C 140 160, 120 180, 100 180 Z M 200 180 C 230 180, 240 150, 240 100 C 240 60, 230 40, 220 30 C 210 20, 200 20, 190 30 C 170 50, 160 80, 160 120 C 160 160, 180 180, 200 180 Z M 80 20 C 85 15, 95 15, 100 20 M 110 25 C 115 20, 120 20, 125 25 M 220 20 C 215 15, 205 15, 200 20 M 190 25 C 185 20, 180 20, 175 25',
  },
}

const PRESET_COLORS = [
  'hsl(var(--primary))',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#20b26c',
  '#00c2d1',
  '#8b31ff',
  '#ec4899',
]

interface BodyMapEditorProps {
  recordId: string
  mapType?: string
  bodyMaps?: any[]
  onSave: (points: BodyMapPoint[], mapType: string) => void
  onClose: () => void
  specialty: string
}

export function BodyMapEditor({
  recordId,
  mapType = 'body_front',
  bodyMaps = [],
  onSave,
  onClose,
  specialty,
}: BodyMapEditorProps) {
  const { toast } = useToast()
  const svgRef = useRef<HTMLDivElement>(null)

  const [activeMapType, setActiveMapType] = useState(mapType)

  const [pointsByMap, setPointsByMap] = useState<Record<string, BodyMapPoint[]>>(() => {
    const initial: Record<string, BodyMapPoint[]> = {}
    bodyMaps.forEach((m) => {
      initial[m.map_type] = m.points || []
    })
    return initial
  })

  const points = pointsByMap[activeMapType] || []

  const setPoints = (newPoints: BodyMapPoint[] | ((prev: BodyMapPoint[]) => BodyMapPoint[])) => {
    setPointsByMap((prev) => {
      const p = typeof newPoints === 'function' ? newPoints(prev[activeMapType] || []) : newPoints
      return { ...prev, [activeMapType]: p }
    })
  }

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [newPointId, setNewPointId] = useState<string | null>(null)
  const [deletingPointId, setDeletingPointId] = useState<string | null>(null)
  const [hoveringPointId, setHoveringPointId] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, BodyMapPoint[][]>>({})
  const [saving, setSaving] = useState(false)
  const [isSavingSuccess, setIsSavingSuccess] = useState(false)
  const [isSwitchingMap, setIsSwitchingMap] = useState(false)
  const [zoom, setZoom] = useState(1)

  const [draggingPointId, setDraggingPointId] = useState<string | null>(null)

  const availableTypes = useMemo(() => {
    if (specialty.toLowerCase() === 'dermatologia') {
      return ['body_front', 'body_back', 'face_front', 'face_left', 'face_right']
    } else if (specialty.toLowerCase() === 'ortopedia') {
      return ['body_front', 'body_back', 'hands', 'feet']
    }
    return ['body_front', 'body_back']
  }, [specialty])

  const mapHistory = history[activeMapType] || []

  const pushHistory = (newPoints: BodyMapPoint[]) => {
    setHistory((prev) => {
      const typeHist = prev[activeMapType] || []
      const h = [...typeHist, JSON.parse(JSON.stringify(newPoints))]
      if (h.length > 20) return { ...prev, [activeMapType]: h.slice(h.length - 20) }
      return { ...prev, [activeMapType]: h }
    })
  }

  const handleUndo = () => {
    if (mapHistory.length === 0 || saving) return
    const h = [...mapHistory]
    const last = h.pop()!
    setHistory((prev) => ({ ...prev, [activeMapType]: h }))
    setPoints(last)
    if (!last.find((p) => p.id === selectedPointId)) setSelectedPointId(null)
  }

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingPointId || isSwitchingMap || saving) return
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const id = crypto.randomUUID()
    const newPoint: BodyMapPoint = {
      id,
      x,
      y,
      label: '',
      color: PRESET_COLORS[0],
    }
    pushHistory(points)
    setPoints([...points, newPoint])
    setNewPointId(id)
    setSelectedPointId(id)
  }

  const startDrag = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation()
    if (saving) return
    pushHistory(points)
    setDraggingPointId(id)
    setSelectedPointId(id)
  }

  const onDragMove = (e: MouseEvent | TouchEvent) => {
    if (!draggingPointId || !svgRef.current || saving) return

    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const rect = svgRef.current.getBoundingClientRect()
    let x = ((clientX - rect.left) / rect.width) * 100
    let y = ((clientY - rect.top) / rect.height) * 100

    x = Math.max(0, Math.min(100, x))
    y = Math.max(0, Math.min(100, y))

    setPoints((prev) => prev.map((p) => (p.id === draggingPointId ? { ...p, x, y } : p)))
  }

  const endDrag = () => {
    setDraggingPointId(null)
  }

  useEffect(() => {
    if (draggingPointId) {
      window.addEventListener('mousemove', onDragMove)
      window.addEventListener('mouseup', endDrag)
      window.addEventListener('touchmove', onDragMove, { passive: false })
      window.addEventListener('touchend', endDrag)
      return () => {
        window.removeEventListener('mousemove', onDragMove)
        window.removeEventListener('mouseup', endDrag)
        window.removeEventListener('touchmove', onDragMove)
        window.removeEventListener('touchend', endDrag)
      }
    }
  }, [draggingPointId])

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.2, 3))
    } else {
      setZoom((z) => Math.max(z - 0.2, 1))
    }
  }

  const updateSelectedPoint = (updates: Partial<BodyMapPoint>) => {
    if (!selectedPointId || saving) return
    pushHistory(points)
    setPoints((prev) => prev.map((p) => (p.id === selectedPointId ? { ...p, ...updates } : p)))
  }

  const removeSelectedPoint = () => {
    if (!selectedPointId || saving) return
    const id = selectedPointId
    setDeletingPointId(id)
    setTimeout(() => {
      pushHistory(points)
      setPoints((prev) => prev.filter((p) => p.id !== id))
      setSelectedPointId(null)
      setDeletingPointId(null)
    }, 200)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await bodyMapService.saveBodyMap(recordId, activeMapType, points, '')
      setIsSavingSuccess(true)
      setTimeout(() => {
        setIsSavingSuccess(false)
        toast({ title: 'Mapa corporal salvo com sucesso', variant: 'default' })
        onSave(points, activeMapType)
        onClose()
      }, 300)
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar mapa corporal.',
        description: e.message,
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  const handleMapTypeChange = (t: string) => {
    if (t === activeMapType || saving) return
    setIsSwitchingMap(true)
    setTimeout(() => {
      setActiveMapType(t)
      setSelectedPointId(null)
      setZoom(1)
    }, 100)
    setTimeout(() => {
      setIsSwitchingMap(false)
    }, 200)
  }

  const selectedPoint = points.find((p) => p.id === selectedPointId)
  const svgData = SVG_PATHS[activeMapType] || SVG_PATHS['body_front']

  const totalUnits = useMemo(() => {
    if (specialty.toLowerCase() !== 'dermatologia') return null
    return points.reduce((acc, p) => {
      if (!p.units) return acc
      const num = parseFloat(p.units.replace(/[^0-9.]/g, ''))
      return acc + (isNaN(num) ? 0 : num)
    }, 0)
  }, [points, specialty])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[1100px] w-full h-[100dvh] md:h-[90vh] p-0 flex flex-col border-none md:border-solid md:border-border rounded-none md:rounded-xl overflow-hidden shadow-none md:shadow-[0_20px_60px_rgba(0,0,0,0.15)] bg-card gap-0">
        <style>{`
          @keyframes point-scale-in {
            0% { transform: scale(0); }
            60% { transform: scale(1.3); }
            100% { transform: scale(1); }
          }
          .animate-point-scale-in {
            animation: point-scale-in 300ms ease-out;
          }
          @keyframes flash-opacity {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          .animate-flash {
            animation: flash-opacity 300ms ease-in-out;
          }
          @keyframes fade-switch {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          .animate-map-switch {
            animation: fade-switch 200ms ease-in-out;
          }
        `}</style>

        <div className="p-4 md:px-6 md:py-4 flex items-center justify-between border-b border-border bg-card shrink-0">
          <DialogTitle className="text-[16px] font-semibold text-foreground">
            {MAP_TYPES[activeMapType]}
          </DialogTitle>

          <div className="hidden md:flex gap-1">
            {availableTypes.map((t) => (
              <button
                key={t}
                onClick={() => handleMapTypeChange(t)}
                className={cn(
                  'h-8 px-3 text-[12px] font-medium rounded-full border bg-transparent transition-all duration-150',
                  activeMapType === t
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {MAP_TYPES[t].split(' - ')[1] || MAP_TYPES[t]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className={cn(
                'h-8 text-muted-foreground hidden sm:flex',
                (mapHistory.length === 0 || saving) && 'opacity-35 pointer-events-none',
              )}
              onClick={handleUndo}
            >
              <Undo className="w-[14px] h-[14px] mr-1.5" /> Desfazer
            </Button>
            <Button
              variant="outline"
              className="h-8 text-[12px] hidden sm:flex"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              className="h-8 text-[12px] font-semibold hidden sm:flex"
              disabled={saving}
              onClick={handleSave}
            >
              Salvar
            </Button>
          </div>
        </div>

        <div className="flex md:hidden gap-1 p-2 border-b border-border overflow-x-auto shrink-0 bg-card">
          {availableTypes.map((t) => (
            <button
              key={t}
              onClick={() => handleMapTypeChange(t)}
              className={cn(
                'h-8 px-3 text-[12px] font-medium rounded-full border bg-transparent transition-all duration-150 shrink-0',
                activeMapType === t
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {MAP_TYPES[t]}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div
            className={cn(
              'w-full md:w-[65%] h-[45vh] md:h-full bg-[hsl(215,25%,97%)] dark:bg-[hsl(215,25%,7%)] border-b md:border-b-0 md:border-r border-border relative flex items-center justify-center p-5',
              zoom > 1 ? 'overflow-auto' : 'overflow-hidden',
            )}
            onWheel={handleWheel}
          >
            <div
              ref={svgRef}
              className={cn(
                'relative transition-transform duration-100 touch-none w-full h-full flex items-center justify-center max-w-[400px]',
                draggingPointId
                  ? 'cursor-grabbing'
                  : hoveringPointId
                    ? 'cursor-grab'
                    : 'cursor-crosshair',
                isSwitchingMap && 'animate-map-switch',
                isSavingSuccess && 'animate-flash',
              )}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              onClick={handleMapClick}
            >
              <svg
                viewBox={svgData.viewBox}
                className="w-full h-full stroke-foreground/15 dark:stroke-foreground/12 stroke-[1.5px] fill-none pointer-events-none"
              >
                <path d={svgData.path} strokeLinejoin="round" strokeLinecap="round" />
              </svg>

              {points.length === 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card/85 backdrop-blur-[4px] px-6 py-4 rounded-xl border border-border/50 flex flex-col items-center pointer-events-none text-center">
                  <MousePointerClick className="w-6 h-6 text-muted-foreground mb-2" />
                  <span className="text-[13px] text-muted-foreground">
                    Clique para marcar um ponto
                  </span>
                </div>
              )}

              {points.map((p, i) => {
                const isNew = p.id === newPointId
                const isSelected = p.id === selectedPointId
                const isDeleting = p.id === deletingPointId

                return (
                  <div
                    key={p.id}
                    className="absolute group z-10"
                    style={
                      {
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        transform: 'translate(-50%, -50%)',
                        '--marker-color': p.color || PRESET_COLORS[0],
                      } as React.CSSProperties
                    }
                    onMouseDown={(e) => startDrag(e, p.id)}
                    onTouchStart={(e) => startDrag(e, p.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPointId(p.id)
                    }}
                    onMouseEnter={() => setHoveringPointId(p.id)}
                    onMouseLeave={() => setHoveringPointId(null)}
                  >
                    <div
                      className={cn(
                        'w-[14px] h-[14px] rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.15)] transition-transform duration-150 ease-out',
                        isSelected &&
                          'scale-[1.2] shadow-[0_0_0_3px_color-mix(in_srgb,var(--marker-color)_35%,transparent),0_1px_4px_rgba(0,0,0,0.15)]',
                        !isSelected && 'group-hover:scale-[1.35] group-hover:z-10',
                        isNew && 'animate-point-scale-in',
                        isDeleting && 'opacity-0 scale-75 transition-all duration-200',
                      )}
                      style={{ backgroundColor: 'var(--marker-color)' }}
                      onAnimationEnd={() => {
                        if (isNew) setNewPointId(null)
                      }}
                    />

                    <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
                      {p.label || `Ponto ${i + 1}`}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-foreground" />
                    </div>

                    {p.units && (
                      <div className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 text-[9px] font-bold bg-white dark:bg-card text-foreground px-1 py-[1px] rounded border border-border pointer-events-none z-20">
                        {p.units}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {zoom > 1 && (
              <Button
                variant="ghost"
                className="absolute bottom-4 right-4 h-7 text-[11px] gap-1 bg-card/90 backdrop-blur-[4px] border border-border rounded-md z-20"
                onClick={() => setZoom(1)}
              >
                <ZoomOut className="w-3 h-3" /> Resetar Zoom
              </Button>
            )}
          </div>

          <div className="w-full md:w-[35%] h-[55vh] md:h-full bg-card flex flex-col p-4 md:p-5 overflow-y-auto">
            {!selectedPoint ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-10 text-center animate-in fade-in duration-200">
                <MousePointerClick className="w-8 h-8 text-muted-foreground/25 mb-3" />
                <span className="text-[14px] font-medium text-muted-foreground mt-3">
                  Selecione ou adicione um ponto
                </span>
                <span className="text-[12px] text-muted-foreground/50 mt-1">
                  Clique no mapa ao lado
                </span>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                  <h4 className="text-[14px] font-semibold">
                    Ponto {points.findIndex((p) => p.id === selectedPoint.id) + 1}
                  </h4>
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedPoint.color || PRESET_COLORS[0] }}
                  />
                  {selectedPoint.label && (
                    <span className="text-[12px] text-muted-foreground ml-auto">
                      {selectedPoint.label}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3.5">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px] mb-[2px] block">
                      Descrição
                    </label>
                    <Input
                      className="h-[40px] md:h-9 text-[13px] bg-input border-border rounded-[calc(var(--radius)-2px)] px-2.5 focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Ex: Glabela, Frontal direito"
                      value={selectedPoint.label || ''}
                      onChange={(e) => updateSelectedPoint({ label: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px] mb-[2px] block">
                      Produto
                    </label>
                    <Input
                      className="h-[40px] md:h-9 text-[13px] bg-input border-border rounded-[calc(var(--radius)-2px)] px-2.5 focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Ex: Botox, Restylane"
                      value={selectedPoint.product || ''}
                      onChange={(e) => updateSelectedPoint({ product: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px] mb-[2px] block">
                      Unidades/Dose
                    </label>
                    <Input
                      className="h-[40px] md:h-9 text-[13px] bg-input border-border rounded-[calc(var(--radius)-2px)] px-2.5 focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Ex: 4U, 0.5mL"
                      value={selectedPoint.units || ''}
                      onChange={(e) => updateSelectedPoint({ units: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px] mb-[2px] block">
                      Lote
                    </label>
                    <Input
                      className="h-[40px] md:h-9 text-[13px] bg-input border-border rounded-[calc(var(--radius)-2px)] px-2.5 focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Numero do lote"
                      value={selectedPoint.lot_number || ''}
                      onChange={(e) => updateSelectedPoint({ lot_number: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px] mb-[2px] block">
                      Observações
                    </label>
                    <Textarea
                      className="min-h-[60px] text-[13px] bg-input border-border rounded-[calc(var(--radius)-2px)] px-2.5 py-2 focus-visible:ring-1 focus-visible:ring-ring resize-y"
                      placeholder="Detalhes adicionais..."
                      value={selectedPoint.notes || ''}
                      onChange={(e) => updateSelectedPoint({ notes: e.target.value })}
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.3px] mb-[2px] block mt-1">
                      Cor do Marcador
                    </label>
                    <div className="flex gap-2 mt-1">
                      {PRESET_COLORS.map((c) => {
                        const isColorSelected = (selectedPoint.color || PRESET_COLORS[0]) === c
                        return (
                          <div
                            key={c}
                            onClick={() => !saving && updateSelectedPoint({ color: c })}
                            className={cn(
                              'w-[28px] h-[28px] md:w-[24px] md:h-[24px] rounded-full cursor-pointer transition-transform duration-150 border-2 border-transparent',
                              isColorSelected
                                ? 'border-white shadow-[0_0_0_2px_var(--c)] scale-[1.1]'
                                : 'hover:scale-[1.15]',
                            )}
                            style={{ backgroundColor: c, '--c': c } as React.CSSProperties}
                          />
                        )
                      })}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={removeSelectedPoint}
                    disabled={saving}
                    className="mt-3 pt-3 border-t border-border/30 w-full h-8 text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 justify-center rounded-none"
                  >
                    <Trash2 className="w-3 h-3" /> Remover Ponto
                  </Button>
                </div>
              </div>
            )}

            {points.length > 0 && (
              <>
                <div className="h-[1px] bg-border/30 my-4 shrink-0" />
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground mb-2">
                    Todos os Pontos
                  </h5>
                  <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-visible snap-x pb-2 md:pb-0">
                    {points.map((p, i) => (
                      <div
                        key={p.id}
                        className={cn(
                          'snap-center min-w-[140px] md:min-w-0 flex-shrink-0 p-2 px-3 bg-secondary/15 rounded-[calc(var(--radius)-2px)] cursor-pointer flex items-center gap-2 transition-all duration-150 border-[1.5px] hover:bg-secondary/30',
                          selectedPointId === p.id
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent',
                        )}
                        onClick={() => setSelectedPointId(p.id)}
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color || PRESET_COLORS[0] }}
                        />
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span
                            className={cn(
                              'text-[12px] truncate',
                              p.label ? 'font-medium' : 'italic text-muted-foreground/50',
                            )}
                          >
                            {p.label || 'Sem descricao'}
                          </span>
                          {p.product && (
                            <span className="text-[10px] text-muted-foreground truncate before:content-['·'] before:mr-1.5">
                              {p.product}
                            </span>
                          )}
                        </div>
                        {p.units && (
                          <span className="text-[10px] font-semibold text-primary shrink-0">
                            {p.units}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-4 md:px-6 py-3 border-t border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">
              {points.length} pontos marcados
            </span>
            {totalUnits !== null && (
              <>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-[12px] font-semibold text-primary">
                  Total: {totalUnits} unidades
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 text-[13px]"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              className="h-9 text-[13px] font-semibold"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Mapa'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function BodyMapPreview({
  map,
  specialty,
  onEdit,
  variant = 'default',
}: {
  map: any
  specialty: string
  onEdit: () => void
  variant?: 'default' | 'compact'
}) {
  const points = map.points || []
  const svgData = SVG_PATHS[map.map_type] || SVG_PATHS['body_front']

  const totalUnits = useMemo(() => {
    if (specialty.toLowerCase() !== 'dermatologia') return null
    return points.reduce((acc: number, p: any) => {
      if (!p.units) return acc
      const num = parseFloat(p.units.replace(/[^0-9.]/g, ''))
      return acc + (isNaN(num) ? 0 : num)
    }, 0)
  }, [points, specialty])

  if (variant === 'compact') {
    return (
      <div className="p-3 px-4 bg-secondary/10 rounded-xl flex items-center gap-4 mb-2">
        <div className="relative w-[80px] h-[80px] flex items-center justify-center shrink-0">
          <svg
            viewBox={svgData.viewBox}
            className="h-full w-auto stroke-foreground/10 stroke-[2px] fill-none max-w-full"
          >
            <path d={svgData.path} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {points.map((p: any) => (
            <div
              key={p.id}
              className="absolute w-[4px] h-[4px] rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                backgroundColor: p.color || PRESET_COLORS[0],
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate">
            {MAP_TYPES[map.map_type] || map.map_type}
          </div>
          <div className="text-[11px] text-muted-foreground">{points.length} pontos</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="w-[14px] h-[14px]" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className="bg-secondary/10 border border-border rounded-xl p-4 cursor-pointer transition-all duration-150 hover:border-primary/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      onClick={onEdit}
    >
      <div className="relative w-full h-[160px] flex items-center justify-center overflow-hidden">
        <svg
          viewBox={svgData.viewBox}
          className="h-full w-auto stroke-foreground/10 stroke-[2px] fill-none max-w-full"
        >
          <path d={svgData.path} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {points.map((p: any) => (
          <div
            key={p.id}
            className="absolute w-[6px] h-[6px] rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: p.color || PRESET_COLORS[0],
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">
            {points.length} pontos
          </span>
          {totalUnits !== null && (
            <>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="text-[12px] font-semibold text-primary">
                Total: {totalUnits} unidades
              </span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[12px] text-primary hover:bg-primary/10 gap-1.5 px-2 rounded-md"
        >
          <Pencil className="w-3 h-3" /> Editar Mapa
        </Button>
      </div>
    </div>
  )
}
