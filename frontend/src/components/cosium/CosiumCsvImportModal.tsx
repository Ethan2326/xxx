import { useState, useRef, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Upload, RefreshCw, CheckCircle, FileText, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import api, { integrationsAPI, type CosiumSyncMatch, type CosiumSyncPreview } from '@/services/api'

interface Props {
  onClose: () => void
}

type Step = 'idle' | 'loading' | 'preview' | 'applying' | 'done'

function ScoreBadge({ score }: { score: number }) {
  if (score === 100) return <span className="badge bg-green-100 text-green-700">NIR exact</span>
  if (score >= 90)   return <span className="badge bg-green-100 text-green-700">{score}%</span>
  if (score >= 60)   return <span className="badge bg-yellow-100 text-yellow-700">{score}%</span>
  if (score >= 30)   return <span className="badge bg-orange-100 text-orange-700">{score}%</span>
  return <span className="badge bg-gray-100 text-gray-500">Pas de match</span>
}

function PatientCell({ p }: {
  p: { first_name?: string; last_name?: string; birth_date?: string; nir?: string; cosium_id?: string } | null
}) {
  if (!p) return <span className="text-gray-400 italic text-sm">Aucune correspondance</span>
  return (
    <div className="text-sm">
      <div className="font-semibold text-gray-900">
        {(p.last_name || '').toUpperCase()} {p.first_name}
      </div>
      {p.birth_date && <div className="text-gray-500 text-xs">{p.birth_date}</div>}
      {p.nir        && <div className="text-gray-400 text-xs font-mono">{p.nir}</div>}
      {p.cosium_id  && <div className="text-brand-500 text-xs">ID: {p.cosium_id}</div>}
    </div>
  )
}

export default function CosiumCsvImportModal({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep]       = useState<Step>('idle')
  const [preview, setPreview] = useState<CosiumSyncPreview | null>(null)
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [result, setResult]   = useState<{ applied: number; errors: string[] } | null>(null)
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // ── Upload & preview ──────────────────────────────────────────────────────
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      // Si Excel → convertit en CSV d'abord
      let uploadFile = file
      if (file.name.match(/\.xlsx?$/i)) {
        const buf = await file.arrayBuffer()
        const wb  = XLSX.read(buf, { type: 'array', cellDates: true })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
        uploadFile = new File([csv], file.name.replace(/\.xlsx?$/i, '.csv'), { type: 'text/csv' })
      }
      const form = new FormData()
      form.append('file', uploadFile)
      const res = await api.post<CosiumSyncPreview>(
        '/integrations/cosium/import-csv/preview',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return res.data
    },
    onSuccess: (data) => {
      setPreview(data)
      const init: Record<string, boolean> = {}
      data.matches.forEach(m => {
        if (m.local_patient_id) init[m.cosium_id] = m.auto_match
      })
      setAccepted(init)
      setStep('preview')
    },
    onError: () => setStep('idle'),
  })

  const applyMutation = useMutation({
    mutationFn: (links: { local_id: string; cosium_id: string }[]) =>
      integrationsAPI.cosiumSyncApply(links).then(r => r.data),
    onSuccess: (data) => { setResult(data); setStep('done') },
    onError:   ()     => setStep('preview'),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const pendingLinks = useMemo(() => {
    if (!preview) return []
    return preview.matches
      .filter(m => accepted[m.cosium_id] && m.local_patient_id)
      .map(m => ({ local_id: m.local_patient_id!, cosium_id: m.cosium_id }))
  }, [preview, accepted])

  const { autoMatches, partialMatches, noMatches } = useMemo(() => ({
    autoMatches:    preview?.matches.filter(m => m.auto_match && m.local_patient_id) ?? [],
    partialMatches: preview?.matches.filter(m => !m.auto_match && m.local_patient_id) ?? [],
    noMatches:      preview?.matches.filter(m => !m.local_patient_id) ?? [],
  }), [preview])

  function handleFile(file: File) {
    setFileName(file.name)
    setStep('loading')
    previewMutation.mutate(file)
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function toggleAll(matches: CosiumSyncMatch[], value: boolean) {
    const upd: Record<string, boolean> = {}
    matches.forEach(m => { if (m.local_patient_id) upd[m.cosium_id] = value })
    setAccepted(prev => ({ ...prev, ...upd }))
  }

  function MatchTable({ matches, title }: { matches: CosiumSyncMatch[]; title: string }) {
    if (!matches.length) return null
    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            {title} <span className="text-gray-400 font-normal">({matches.length})</span>
          </h3>
          <div className="flex gap-3">
            <button className="text-xs text-brand-600 hover:underline" onClick={() => toggleAll(matches, true)}>
              Tout accepter
            </button>
            <button className="text-xs text-gray-500 hover:underline" onClick={() => toggleAll(matches, false)}>
              Tout refuser
            </button>
          </div>
        </div>
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Patient Cosium</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Patient local</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">Confiance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {matches.map(m => (
                <tr key={m.cosium_id} className={accepted[m.cosium_id] ? 'bg-green-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!accepted[m.cosium_id]}
                      onChange={e => setAccepted(p => ({ ...p, [m.cosium_id]: e.target.checked }))}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2"><PatientCell p={m.cosium_patient as any} /></td>
                  <td className="px-3 py-2"><PatientCell p={m.local_patient as any} /></td>
                  <td className="px-3 py-2"><ScoreBadge score={m.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import CSV Cosium</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Importe l'export patient de Cosium pour lier automatiquement les fiches
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* ── Idle ─────────────────────────────────────────────────────── */}
          {step === 'idle' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">Comment exporter depuis Cosium :</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>Dans Cosium → menu <strong>Patients</strong> → liste complète</li>
                  <li>Cherche le bouton <strong>Exporter</strong> ou <strong>Export Excel</strong></li>
                  <li>Télécharge le fichier <strong>CSV ou Excel (.xlsx)</strong></li>
                  <li>Glisse-le ici ou clique pour l'importer</li>
                </ol>
              </div>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-600">Glisse ton fichier ici</p>
                <p className="text-sm text-gray-400 mt-1">ou clique pour sélectionner</p>
                <p className="text-xs text-gray-400 mt-2">CSV, TSV ou Excel (.xlsx)</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls"
                  className="hidden"
                  onChange={onFileInput}
                />
              </div>

              {previewMutation.isError && (
                <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700 flex gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Erreur de lecture du fichier</p>
                    <p className="mt-0.5 text-red-600">
                      {(previewMutation.error as any)?.response?.data?.detail?.message
                        || (previewMutation.error as any)?.response?.data?.detail
                        || "Vérifie que le fichier est bien un export Cosium (CSV ou Excel)"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Loading ───────────────────────────────────────────────────── */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
              <p className="text-gray-600">Analyse de <strong>{fileName}</strong>…</p>
            </div>
          )}

          {/* ── Preview ───────────────────────────────────────────────────── */}
          {step === 'preview' && preview && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Lignes dans le CSV', value: preview.total_csv_rows ?? preview.total_cosium, color: 'blue' },
                  { label: 'Correspondances exactes', value: autoMatches.length, color: 'green' },
                  { label: 'Correspondances probables', value: partialMatches.length, color: 'yellow' },
                  { label: 'Sans correspondance', value: noMatches.length, color: 'gray' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`p-3 rounded-xl bg-${color}-50 border border-${color}-100`}>
                    <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
                    <div className={`text-xs text-${color}-600 mt-0.5`}>{label}</div>
                  </div>
                ))}
              </div>

              <div className="max-h-[50vh] overflow-y-auto pr-1">
                <MatchTable matches={autoMatches} title="✅ Correspondances exactes (auto-acceptées)" />
                <MatchTable matches={partialMatches} title="⚠️ Correspondances probables (à confirmer)" />
                {noMatches.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">
                      ❌ Patients Cosium sans correspondance locale ({noMatches.length})
                    </h3>
                    <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                      {noMatches.map(m => (
                        <div key={m.cosium_id} className="px-3 py-2">
                          <PatientCell p={m.cosium_patient as any} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-brand-600">{pendingLinks.length}</span> liaison{pendingLinks.length > 1 ? 's' : ''} à enregistrer
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary" onClick={() => { setStep('idle'); setPreview(null) }}>
                    Changer de fichier
                  </button>
                  <button
                    className="btn-primary"
                    disabled={pendingLinks.length === 0 || applyMutation.isPending}
                    onClick={() => { setStep('applying'); applyMutation.mutate(pendingLinks) }}
                  >
                    Appliquer {pendingLinks.length} liaison{pendingLinks.length > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Applying ──────────────────────────────────────────────────── */}
          {step === 'applying' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
              <p className="text-gray-600">Enregistrement des liaisons…</p>
            </div>
          )}

          {/* ── Done ──────────────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">
                  {result.applied} patient{result.applied > 1 ? 's' : ''} lié{result.applied > 1 ? 's' : ''} à Cosium !
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Les appareils, devis et RDV Cosium sont maintenant visibles sur chaque fiche patient.
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 w-full max-w-sm">
                  <p className="text-sm font-semibold text-red-700 mb-1">Erreurs ({result.errors.length})</p>
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
              <button className="btn-primary px-8" onClick={onClose}>Fermer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
