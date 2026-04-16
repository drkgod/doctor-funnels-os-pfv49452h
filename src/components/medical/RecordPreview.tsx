import { format } from 'date-fns'
import { Printer, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface RecordPreviewProps {
  record: any
  patient: any
  doctor: any
  tenant: any
  specialtyTemplate: any
  bodyMaps: any[]
  transcription: any
  isLoading?: boolean
  error?: string
  onClose?: () => void
}

export function RecordPreview({
  record,
  patient,
  doctor,
  tenant,
  specialtyTemplate,
  bodyMaps,
  transcription,
  isLoading,
  error,
  onClose,
}: RecordPreviewProps) {
  if (isLoading) {
    return (
      <div className="p-8 space-y-6 bg-white h-full w-full">
        <Skeleton className="h-12 w-full bg-gray-200" />
        <Skeleton className="h-32 w-full bg-gray-200" />
        <Skeleton className="h-48 w-full bg-gray-200" />
        <Skeleton className="h-48 w-full bg-gray-200" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center h-full bg-white text-black">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-[hsl(215,25%,15%)]">Erro ao carregar prontuário</h3>
        <p className="text-sm text-[hsl(215,15%,55%)] mt-2">{error}</p>
      </div>
    )
  }

  const sections = record?.sections || []
  const rec = record?.record || {}

  const hasContent = sections.some(
    (s: any) =>
      s.content?.trim() || (s.structured_data && Object.keys(s.structured_data).length > 0),
  )

  if (!hasContent) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center h-full bg-white text-black relative z-10">
        {onClose && (
          <Button variant="ghost" className="absolute top-4 right-4" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
        <div className="text-[hsl(215,15%,55%)] mb-4 text-4xl">📄</div>
        <p className="text-[hsl(215,25%,15%)] font-medium text-lg">Prontuário vazio.</p>
        <p className="text-sm text-[hsl(215,15%,55%)] mt-1">
          Preencha os campos ou grave uma consulta.
        </p>
      </div>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const subjective = sections.find((s: any) => s.section_type === 'subjective') || {}
  const objective = sections.find((s: any) => s.section_type === 'objective') || {}
  const assessment = sections.find((s: any) => s.section_type === 'assessment') || {}
  const plan = sections.find((s: any) => s.section_type === 'plan') || {}
  const vitalSigns = sections.find((s: any) => s.section_type === 'vital_signs') || {}
  const vsData = vitalSigns.structured_data || {}
  const specialtyFields = sections.find((s: any) => s.section_type === 'specialty_fields') || {}
  const spData = specialtyFields.structured_data || {}

  const getRecordTypeColor = (type: string) => {
    const map: Record<string, string> = {
      consultation: 'hsl(215, 70%, 50%)',
      return: 'hsl(152, 68%, 40%)',
      procedure: 'hsl(270, 60%, 50%)',
      emergency: 'hsl(0, 84%, 55%)',
    }
    return map[type] || 'hsl(215, 15%, 55%)'
  }

  const getRecordTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      consultation: 'Consulta',
      return: 'Retorno',
      procedure: 'Procedimento',
      emergency: 'Emergência',
    }
    return map[type] || type
  }

  const renderSoapSection = (title: string, sectionData: any) => {
    return (
      <div className="mt-6 z-10 relative print:break-inside-avoid">
        <div className="text-[13px] font-bold uppercase tracking-[0.5px] text-[hsl(215,25%,15%)] pb-1.5 border-b border-[hsl(0,0%,88%)] flex items-center font-['Plus_Jakarta_Sans']">
          {title}
          {sectionData?.ai_generated && (
            <span className="text-[9px] font-semibold text-[hsl(215,70%,50%)] ml-2">(IA)</span>
          )}
        </div>
        <div className="mt-2.5 text-[12px] leading-[1.7] text-[hsl(215,25%,20%)] whitespace-pre-wrap font-sans print:font-serif">
          {sectionData?.content?.trim() ? (
            sectionData.content
          ) : (
            <span className="text-[11px] italic text-[hsl(215,15%,65%)]">Não preenchido</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-white text-black min-h-full w-full font-sans">
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body { margin: 0; padding: 0; background: white; }
          body * { visibility: hidden; }
          #preview-dialog-content { 
            overflow: visible !important; 
            max-height: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          #print-area, #print-area * { visibility: visible; }
          #print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            color: black; 
            background: white;
            padding: 20mm !important;
            max-width: none !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Top toolbar */}
      <div className="sticky top-0 left-0 right-0 bg-white border-b border-[hsl(0,0%,88%)] py-3 px-6 flex items-center justify-between z-50 no-print">
        <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)] hidden sm:block font-['Plus_Jakarta_Sans']">
          Prontuário Médico
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            onClick={handlePrint}
            className="h-9 flex-1 sm:flex-none px-4 text-[13px] font-medium bg-[hsl(215,25%,15%)] text-white hover:bg-[hsl(215,25%,25%)] rounded-md gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
            <span className="sm:hidden">Imprimir</span>
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              onClick={onClose}
              className="h-9 px-3 text-[13px] text-[hsl(215,25%,15%)] hover:bg-black/5"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1.5">Fechar</span>
            </Button>
          )}
        </div>
      </div>

      <div id="print-area" className="p-5 md:p-10 max-w-[780px] mx-auto bg-white relative z-[1]">
        {/* Draft Watermark */}
        {rec.status !== 'signed' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden print:fixed print:inset-0 print:flex">
            <div className="text-[72px] font-black text-[hsl(0,0%,90%)] -rotate-30 select-none whitespace-nowrap">
              RASCUNHO
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start z-10 relative">
          <div className="flex items-center">
            {tenant?.logo_url && (
              <img src={tenant.logo_url} alt="Logo" className="max-h-[40px] mr-3" />
            )}
            <div>
              <div className="text-[18px] font-bold text-[hsl(215,25%,15%)] font-['Plus_Jakarta_Sans'] leading-tight">
                {tenant?.name || 'Clínica'}
              </div>
              {tenant?.address && (
                <div className="text-[10px] text-[hsl(215,15%,55%)] mt-0.5">{tenant.address}</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-[1px] text-[hsl(215,15%,55%)] font-['Plus_Jakarta_Sans']">
              PRONTUÁRIO MÉDICO
            </div>
            <div
              className="text-[11px] font-semibold mt-1"
              style={{ color: getRecordTypeColor(rec.record_type) }}
            >
              {getRecordTypeLabel(rec.record_type || 'consultation')}
            </div>
            <div className="text-[11px] text-[hsl(215,15%,55%)] mt-0.5">
              {format(new Date(rec.created_at || new Date()), 'dd/MM/yyyy')}
            </div>
          </div>
        </div>

        <div className="h-[2px] bg-[hsl(215,25%,15%)] mt-4 mb-6 z-10 relative"></div>

        {/* Patient Info Box */}
        <div className="border border-[hsl(0,0%,85%)] rounded-[6px] p-4 grid grid-cols-1 md:grid-cols-2 gap-3 z-10 relative bg-white print:break-inside-avoid">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[hsl(215,15%,55%)] font-['Plus_Jakarta_Sans']">
              Nome Completo
            </div>
            <div className="text-[12px] font-medium text-[hsl(215,25%,15%)] mt-[2px]">
              {patient?.full_name}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[hsl(215,15%,55%)] font-['Plus_Jakarta_Sans']">
              Telefone
            </div>
            <div className="text-[12px] font-medium text-[hsl(215,25%,15%)] mt-[2px]">
              {patient?.phone || 'Não informado'}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[hsl(215,15%,55%)] font-['Plus_Jakarta_Sans']">
              Email
            </div>
            <div className="text-[12px] font-medium text-[hsl(215,25%,15%)] mt-[2px]">
              {patient?.email || 'Não informado'}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[hsl(215,15%,55%)] font-['Plus_Jakarta_Sans']">
              CPF
            </div>
            <div className="text-[12px] font-medium text-[hsl(215,25%,15%)] mt-[2px]">
              {patient?.cpf || 'Não informado'}
            </div>
          </div>
        </div>

        {rec.chief_complaint && (
          <div className="mt-3 z-10 relative print:break-inside-avoid">
            <span className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] font-['Plus_Jakarta_Sans']">
              Queixa Principal:{' '}
            </span>
            <span className="text-[12px] italic text-[hsl(215,25%,25%)]">
              {rec.chief_complaint}
            </span>
          </div>
        )}

        {/* Doctor Info */}
        <div className="mt-2 text-[11px] text-[hsl(215,15%,55%)] z-10 relative print:break-inside-avoid">
          Profissional:{' '}
          <span className="font-semibold text-[hsl(215,25%,15%)]">Dr(a). {doctor?.full_name}</span>
          {doctor?.specialty ? ` - ${doctor.specialty}` : ''} - CRM{' '}
          {doctor?.crm_number || 'não informado'}/{doctor?.crm_state || ''}
        </div>

        {/* SOAP Sections */}
        {renderSoapSection('ANAMNESE (S)', subjective)}

        {renderSoapSection('EXAME FÍSICO (O)', objective)}

        {/* Vital Signs */}
        {Object.keys(vsData).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 z-10 relative print:break-inside-avoid">
            {vsData.pa_sistolica && vsData.pa_diastolica && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.pa_sistolica}x{vsData.pa_diastolica}
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  PA
                </div>
              </div>
            )}
            {vsData.pa_sistolica && vsData.pa_diastolica && (
              <div className="w-[1px] h-[32px] bg-[hsl(0,0%,88%)] hidden sm:block"></div>
            )}

            {vsData.fc && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.fc} bpm
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  FC
                </div>
              </div>
            )}
            {vsData.fc && (
              <div className="w-[1px] h-[32px] bg-[hsl(0,0%,88%)] hidden sm:block"></div>
            )}

            {vsData.fr && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.fr} irpm
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  FR
                </div>
              </div>
            )}
            {vsData.fr && (
              <div className="w-[1px] h-[32px] bg-[hsl(0,0%,88%)] hidden sm:block"></div>
            )}

            {vsData.temp && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.temp} °C
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  Tax
                </div>
              </div>
            )}
            {vsData.temp && (
              <div className="w-[1px] h-[32px] bg-[hsl(0,0%,88%)] hidden sm:block"></div>
            )}

            {vsData.spo2 && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.spo2} %
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  SpO2
                </div>
              </div>
            )}
            {vsData.spo2 && (
              <div className="w-[1px] h-[32px] bg-[hsl(0,0%,88%)] hidden sm:block"></div>
            )}

            {vsData.peso && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.peso} kg
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  Peso
                </div>
              </div>
            )}
            {vsData.peso && (
              <div className="w-[1px] h-[32px] bg-[hsl(0,0%,88%)] hidden sm:block"></div>
            )}

            {vsData.altura && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.altura} cm
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  Altura
                </div>
              </div>
            )}
            {vsData.altura && (
              <div className="w-[1px] h-[32px] bg-[hsl(0,0%,88%)] hidden sm:block"></div>
            )}

            {vsData.imc && (
              <div className="flex flex-col items-center">
                <div className="text-[14px] font-semibold text-[hsl(215,25%,15%)]">
                  {vsData.imc} <span className="text-[10px] font-normal">({vsData.imc_class})</span>
                </div>
                <div className="text-[9px] font-bold uppercase text-[hsl(215,15%,55%)] mt-[2px] font-['Plus_Jakarta_Sans']">
                  IMC
                </div>
              </div>
            )}
          </div>
        )}

        {/* Specialty Fields */}
        {specialtyTemplate &&
          specialtyTemplate.sections?.length > 0 &&
          Object.keys(spData).length > 0 && (
            <div className="mt-6 z-10 relative print:break-inside-avoid">
              <div className="text-[13px] font-bold uppercase tracking-[0.5px] text-[hsl(215,25%,15%)] pb-1.5 border-b border-[hsl(0,0%,88%)] font-['Plus_Jakarta_Sans']">
                {specialtyTemplate.template_name}
              </div>
              {Array.from(new Set(specialtyTemplate.sections.map((s: any) => s.category))).map(
                (cat: any) => {
                  const fields = specialtyTemplate.sections.filter(
                    (s: any) =>
                      s.category === cat &&
                      s.type !== 'body_map' &&
                      spData[s.key] !== undefined &&
                      spData[s.key] !== '',
                  )
                  if (fields.length === 0) return null
                  return (
                    <div key={cat} className="mt-4">
                      <div className="text-[10px] font-bold uppercase text-[hsl(215,15%,55%)] mb-2 font-['Plus_Jakarta_Sans']">
                        {cat}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {fields.map((f: any) => {
                          const val = spData[f.key]
                          let displayVal = val
                          if (Array.isArray(val)) displayVal = val.join(', ')
                          if (typeof val === 'boolean') displayVal = val ? 'Sim' : 'Não'
                          return (
                            <div key={f.key}>
                              <span className="text-[9px] font-semibold uppercase text-[hsl(215,15%,55%)] mr-1 font-['Plus_Jakarta_Sans']">
                                {f.label}:
                              </span>
                              <span className="text-[11px] text-[hsl(215,25%,15%)]">
                                {displayVal} {f.unit || ''}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          )}

        {/* Body Maps Table */}
        {bodyMaps && bodyMaps.length > 0 && (
          <div className="mt-6 z-10 relative print:break-inside-avoid">
            <div className="text-[13px] font-bold uppercase tracking-[0.5px] text-[hsl(215,25%,15%)] pb-1.5 border-b border-[hsl(0,0%,88%)] font-['Plus_Jakarta_Sans']">
              MAPA CORPORAL
            </div>
            {bodyMaps.map((bm: any) => {
              const mapName = bm.map_type
              return (
                <div key={bm.id} className="mt-4">
                  <div className="text-[10px] font-bold uppercase text-[hsl(215,15%,55%)] mb-2 font-['Plus_Jakarta_Sans']">
                    {mapName}
                  </div>
                  {bm.points && bm.points.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse mt-2">
                        <thead>
                          <tr>
                            <th className="bg-[hsl(0,0%,95%)] text-[9px] font-bold uppercase py-1.5 px-2.5 text-[hsl(215,15%,55%)] text-left font-['Plus_Jakarta_Sans']">
                              Ponto
                            </th>
                            <th className="bg-[hsl(0,0%,95%)] text-[9px] font-bold uppercase py-1.5 px-2.5 text-[hsl(215,15%,55%)] text-left font-['Plus_Jakarta_Sans']">
                              Descrição
                            </th>
                            <th className="bg-[hsl(0,0%,95%)] text-[9px] font-bold uppercase py-1.5 px-2.5 text-[hsl(215,15%,55%)] text-left font-['Plus_Jakarta_Sans']">
                              Produto
                            </th>
                            <th className="bg-[hsl(0,0%,95%)] text-[9px] font-bold uppercase py-1.5 px-2.5 text-[hsl(215,15%,55%)] text-left font-['Plus_Jakarta_Sans']">
                              Unidades
                            </th>
                            <th className="bg-[hsl(0,0%,95%)] text-[9px] font-bold uppercase py-1.5 px-2.5 text-[hsl(215,15%,55%)] text-left font-['Plus_Jakarta_Sans']">
                              Observações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {bm.points.map((p: any, idx: number) => (
                            <tr key={idx} className="border-b border-[hsl(0,0%,92%)]">
                              <td className="text-[11px] py-1.5 px-2.5 text-[hsl(215,25%,15%)]">
                                {idx + 1}
                              </td>
                              <td className="text-[11px] py-1.5 px-2.5 text-[hsl(215,25%,15%)]">
                                {p.label || '-'}
                              </td>
                              <td className="text-[11px] py-1.5 px-2.5 text-[hsl(215,25%,15%)]">
                                {p.product || '-'}
                              </td>
                              <td className="text-[11px] py-1.5 px-2.5 text-[hsl(215,25%,15%)]">
                                {p.units || '-'}
                              </td>
                              <td className="text-[11px] py-1.5 px-2.5 text-[hsl(215,25%,15%)]">
                                {p.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-[11px] italic text-[hsl(215,15%,65%)] mt-1">
                      Sem pontos marcados.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {renderSoapSection('AVALIAÇÃO (A)', assessment)}

        {/* CID-10 */}
        {assessment.structured_data?.cid10?.length > 0 && (
          <div className="mt-2 z-10 relative print:break-inside-avoid">
            <span className="text-[10px] font-bold text-[hsl(215,15%,55%)] font-['Plus_Jakarta_Sans']">
              CID-10:{' '}
            </span>
            <span className="text-[11px] font-medium text-[hsl(215,25%,15%)]">
              {assessment.structured_data.cid10.join(', ')}
            </span>
          </div>
        )}

        {renderSoapSection('CONDUTA (P)', plan)}

        {/* Transcription Summary */}
        {transcription && transcription.status === 'completed' && (
          <div className="mt-6 z-10 relative print:break-inside-avoid">
            <div className="text-[13px] font-bold uppercase tracking-[0.5px] text-[hsl(215,25%,15%)] pb-1.5 border-b border-[hsl(0,0%,88%)] font-['Plus_Jakarta_Sans']">
              TRANSCRIÇÃO DA CONSULTA
            </div>
            <div className="mt-2.5 text-[12px] leading-[1.7] text-[hsl(215,25%,20%)] font-sans print:font-serif">
              Consulta transcrita por IA. Duração:{' '}
              {Math.floor((transcription.duration_seconds || 0) / 60)} minutos.{' '}
              {transcription.speaker_segments?.length || 0} segmentos identificados.
            </div>
          </div>
        )}

        {/* Signature Area */}
        <div className="mt-12 text-center z-10 relative print:break-inside-avoid print:break-before-auto">
          <div className="w-[250px] h-[1px] bg-[hsl(215,25%,15%)] mx-auto"></div>
          <div className="text-[12px] font-semibold text-[hsl(215,25%,15%)] mt-2">
            {doctor?.full_name}
          </div>
          <div className="text-[10px] text-[hsl(215,15%,55%)] mt-[2px]">
            {doctor?.specialty ? `${doctor.specialty} - ` : ''}CRM {doctor?.crm_number || '-'}/
            {doctor?.crm_state || '-'}
          </div>
          <div className="text-[10px] text-[hsl(215,15%,55%)] mt-[2px]">
            {format(new Date(rec.completed_at || rec.updated_at || new Date()), 'dd/MM/yyyy')}
          </div>

          {rec.status === 'signed' && (
            <>
              <div className="text-[10px] font-medium text-[hsl(270,60%,50%)] mt-2">
                Assinado digitalmente em {format(new Date(rec.signed_at), 'dd/MM/yyyy às HH:mm')}
              </div>
              {rec.signature_hash && (
                <div className="text-[9px] text-[hsl(215,15%,55%)] mt-1">
                  Código de verificação: {rec.signature_hash}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-3 border-t border-[hsl(0,0%,88%)] text-center z-10 relative print:break-inside-avoid">
          <div className="text-[9px] text-[hsl(215,15%,65%)]">
            Documento gerado em {format(new Date(), 'dd/MM/yyyy às HH:mm')}
          </div>
        </div>
      </div>
    </div>
  )
}
