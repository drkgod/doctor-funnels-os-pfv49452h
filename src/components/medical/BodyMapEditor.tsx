import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Undo, Trash2, MousePointerClick, Loader2, Maximize, Edit2 } from 'lucide-react'
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
  const [history, setHistory] = useState<Record<string, BodyMapPoint[][]>>({})
  const [saving, setSaving] = useState(false)
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
    if (mapHistory.length === 0) return
    const h = [...mapHistory]
    const last = h.pop()!
    setHistory((prev) => ({ ...prev, [activeMapType]: h }))
    setPoints(last)
    if (!last.find((p) => p.id === selectedPointId)) setSelectedPointId(null)
  }

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingPointId) return
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newPoint: BodyMapPoint = {
      id: crypto.randomUUID(),
      x,
      y,
      label: '',
      color: PRESET_COLORS[0],
    }
    pushHistory(points)
    setPoints([...points, newPoint])
    setSelectedPointId(newPoint.id)
  }

  const startDrag = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation()
    pushHistory(points)
    setDraggingPointId(id)
    setSelectedPointId(id)
  }

  const onDragMove = (e: MouseEvent | TouchEvent) => {
    if (!draggingPointId || !svgRef.current) return

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
    if (!selectedPointId) return
    pushHistory(points)
    setPoints((prev) => prev.map((p) => (p.id === selectedPointId ? { ...p, ...updates } : p)))
  }

  const removeSelectedPoint = () => {
    if (!selectedPointId) return
    pushHistory(points)
    setPoints((prev) => prev.filter((p) => p.id !== selectedPointId))
    setSelectedPointId(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await bodyMapService.saveBodyMap(recordId, activeMapType, points, '')
      toast({ title: 'Mapa corporal salvo com sucesso', variant: 'default' })
      onSave(points, activeMapType)
      onClose()
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar mapa corporal.',
        description: e.message,
        variant: 'destructive',
      })
      setSaving(false)
    }
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
      <DialogContent className="max-w-[1100px] h-[100dvh] md:h-[90vh] p-0 flex flex-col overflow-hidden bg-background gap-0 border-none sm:border-solid">
        <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">{MAP_TYPES[activeMapType]}</DialogTitle>

          <div className="hidden md:flex items-center gap-1 bg-secondary/30 p-1 rounded-md">
            {availableTypes.map((t) => (
              <Button
                key={t}
                variant={activeMapType === t ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setActiveMapType(t)
                  setSelectedPointId(null)
                  setZoom(1)
                }}
              >
                {MAP_TYPES[t]}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={mapHistory.length === 0 || saving}
            >
              <Undo className="w-4 h-4 mr-2" />
              Desfazer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
              className="hidden sm:inline-flex"
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </DialogHeader>

        <div className="flex md:hidden items-center gap-1 bg-secondary/30 p-2 overflow-x-auto shrink-0 border-b">
          {availableTypes.map((t) => (
            <Button
              key={t}
              variant={activeMapType === t ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => {
                setActiveMapType(t)
                setSelectedPointId(null)
                setZoom(1)
              }}
            >
              {MAP_TYPES[t]}
            </Button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* LEFT: SVG Map */}
          <div
            className={cn(
              'relative w-full md:w-[65%] h-[40vh] md:h-full bg-secondary/10 border-b md:border-b-0 md:border-r flex items-center justify-center',
              zoom > 1 ? 'overflow-auto' : 'overflow-hidden',
            )}
            onWheel={handleWheel}
          >
            <div
              ref={svgRef}
              className={cn(
                'relative transition-transform duration-100 touch-none',
                draggingPointId ? 'cursor-grabbing' : 'cursor-crosshair',
              )}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                width: '100%',
                maxWidth: '400px',
                height: '100%',
                maxHeight: '80%',
              }}
              onClick={handleMapClick}
            >
              <svg
                viewBox={svgData.viewBox}
                className="w-full h-full text-foreground/20 drop-shadow-sm pointer-events-none"
              >
                <path
                  d={svgData.path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>

              {points.map((p, i) => (
                <div
                  key={p.id}
                  className="absolute group z-10"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
                  onMouseDown={(e) => startDrag(e, p.id)}
                  onTouchStart={(e) => startDrag(e, p.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedPointId(p.id)
                  }}
                >
                  <div
                    className={cn(
                      'w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm transition-transform cursor-grab hover:scale-125',
                      selectedPointId === p.id && 'ring-2 ring-primary ring-offset-2 scale-110',
                    )}
                    style={{ backgroundColor: p.color || PRESET_COLORS[0] }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                    {p.label || `Ponto ${i + 1}`}
                  </div>
                </div>
              ))}

              {points.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border shadow-sm text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4" />
                    Clique no corpo
                  </div>
                </div>
              )}
            </div>

            {zoom > 1 && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-4 right-4 h-8 text-xs shadow-md z-20"
                onClick={() => setZoom(1)}
              >
                <Maximize className="w-3 h-3 mr-1" />
                Resetar Zoom
              </Button>
            )}
          </div>

          {/* RIGHT: Editor Panel */}
          <div className="w-full md:w-[35%] h-[60vh] md:h-full flex flex-col bg-card">
            {!selectedPoint ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <MousePointerClick className="w-10 h-10 mb-4 opacity-50" />
                <p className="text-sm font-medium">Clique no mapa para adicionar um ponto</p>
                <p className="text-xs mt-2 opacity-70">
                  Selecione um ponto existente para edita-lo.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedPoint.color || PRESET_COLORS[0] }}
                    />
                    <h4 className="font-semibold text-sm">
                      Ponto {points.findIndex((p) => p.id === selectedPoint.id) + 1}
                    </h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={removeSelectedPoint}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descricao</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="Ex: Glabela, Frontal direito"
                      value={selectedPoint.label || ''}
                      onChange={(e) => updateSelectedPoint({ label: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Produto</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="Ex: Botox, Restylane"
                      value={selectedPoint.product || ''}
                      onChange={(e) => updateSelectedPoint({ product: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unidades/Dose</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="Ex: 4U, 0.5mL"
                      value={selectedPoint.units || ''}
                      onChange={(e) => updateSelectedPoint({ units: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lote</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="Numero do lote"
                      value={selectedPoint.lot_number || ''}
                      onChange={(e) => updateSelectedPoint({ lot_number: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Observacoes</Label>
                    <Textarea
                      className="min-h-[60px] text-sm resize-y"
                      placeholder="Detalhes adicionais..."
                      value={selectedPoint.notes || ''}
                      onChange={(e) => updateSelectedPoint({ notes: e.target.value })}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs">Cor do Marcador</Label>
                    <div className="flex gap-2">
                      {PRESET_COLORS.map((c) => (
                        <div
                          key={c}
                          onClick={() => !saving && updateSelectedPoint({ color: c })}
                          className={cn(
                            'w-6 h-6 rounded-full cursor-pointer border-2 transition-all',
                            (selectedPoint.color || PRESET_COLORS[0]) === c
                              ? 'border-foreground scale-110'
                              : 'border-transparent hover:scale-110',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* List of points */}
            {points.length > 0 && (
              <div className="border-t bg-secondary/10 p-3 md:p-4 shrink-0 h-[100px] md:h-[180px] overflow-y-auto">
                <Label className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 block">
                  Todos os Pontos ({points.length})
                </Label>
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                  {points.map((p, i) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPointId(p.id)}
                      className={cn(
                        'flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 p-2 bg-background border rounded-md cursor-pointer transition-colors min-w-[120px] md:min-w-0 shrink-0',
                        selectedPointId === p.id
                          ? 'border-primary ring-1 ring-primary/20'
                          : 'hover:border-foreground/30',
                      )}
                    >
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color || PRESET_COLORS[0] }}
                        />
                        <span className="text-xs font-medium truncate max-w-[80px] md:max-w-[120px]">
                          {p.label || <span className="italic opacity-50">Sem descrição</span>}
                        </span>
                      </div>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-1 md:mt-0 md:ml-auto">
                        {p.product && (
                          <span className="bg-secondary px-1.5 py-0.5 rounded truncate max-w-[60px]">
                            {p.product}
                          </span>
                        )}
                        {p.units && (
                          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            {p.units}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 md:p-4 border-t shrink-0 flex items-center justify-between bg-card">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">{points.length} pontos marcados</span>
            {totalUnits !== null && (
              <span className="text-sm font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                Total: {totalUnits} unidades
              </span>
            )}
          </div>
          <div className="flex md:hidden items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              Salvar
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
}: {
  map: any
  specialty: string
  onEdit: () => void
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

  return (
    <div className="border rounded-md bg-card overflow-hidden flex flex-col group relative">
      <div className="relative w-full h-[140px] bg-secondary/10 flex items-center justify-center p-2">
        <svg viewBox={svgData.viewBox} className="h-full w-auto text-foreground/20 max-w-full">
          <path
            d={svgData.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        {points.map((p: any) => (
          <div
            key={p.id}
            className="absolute w-2 h-2 rounded-full border border-white"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: p.color || PRESET_COLORS[0],
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Button variant="secondary" size="sm" onClick={onEdit} className="shadow-md">
            <Edit2 className="w-3 h-3 mr-1.5" /> Editar
          </Button>
        </div>
      </div>
      <div className="p-3 border-t bg-card flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium">{MAP_TYPES[map.map_type] || map.map_type}</div>
          <div className="text-[11px] text-muted-foreground">{points.length} pontos</div>
        </div>
        {totalUnits !== null && (
          <div className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
            {totalUnits}U
          </div>
        )}
      </div>
    </div>
  )
}
