import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, RefreshCw, Link, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { integrationsAPI, type CosiumSyncMatch, type CosiumSyncPreview } from '@/services/api'

interface Props {
  onClose: () => void
}

type Step = 'idle' | 'loading' | 'preview' | 'applying' | 'done'

function ScoreBadge({ score }: { score: number }) {
  if (score === 100) return <span className="badge bg-green-100 text-green-700">NIR exact</span>
  if (score >= 90)   return <span className="badge bg-green-100 text-green-700">{score}%</span>
  if (score >= 60)   return <span className="badge bg-yellow-100 text-yellow-700">{score}%</span>
  if (score >= 30)   return <span className="badge bg-orange-100 text-orange-700">{score}%</span>
  return <span className="badge bg-gray-100 text-gray-500">—</span>
}

function PatientCell({ p, label }: { p: { first_name: string; last_name: string; birth_date?: string; nir?: string } | null; label?: string }) {
  if (!p) return <span className="text-gray-400 italic text-sm">Aucune correspondance locale</span>
  return (
    <div className="text-sm">
      <div className="font-semibold text-gray-900">{p.last_name.toUpperCase()} {p.first_name}</div>
      {p.birth_date && <div className="text-gray-500 text-xs">{p.birth_date}</div>}
      {p.nir && <div className="text-gray-400 text-xs font-mono">{p.nir}</div>}
      {label && <div className="text-brand-500 text-xs mt-0.5">{label}</div>}
    </div>
  )
}

export default function CosiumSyncModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [preview, setPreview] = useState<CosiumSyncPreview | null>(null)
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<{ applied: number; errors: string[] } | null>(null)
  const [showUnmatched, setShowUnmatched] = useState(false)
  const [maxCosium, setMaxCosium] = useState(200)

  // ── Preview query ─────────────────────────────────────────────────────────
  const previewMutation = useMutation({
    mutationFn: () => integrationsAPI.cosiumSyncPreview(maxCosium).then(r => r.data),
    onSuccess: (data) => {
      setPreview(data)
      // Auto-accept all high-confidence matches
      const initial: Record<string, boolean> = {}
      data.matches.forEach(m => {
        if (m.local_patient_id) {
          initial[m.cosium_id] = m.auto_match
        }
      })
      setAccepted(initial)
      setStep('preview')
    },
    onError: () => setStep('idle'),
  })

  // ── Apply mutation ────────────────────────────────────────────────────────
  const applyMutation = useMutation({
    mutationFn: (links: { local_id: string; cosium_id: string }[]) =>
      integrationsAPI.cosiumSyncApply(links).then(r => r.data),
    onSuccess: (data) => {
      setResult(data)
      setStep('done')
    },
    onError: () => setStep('preview'),
  })

  // ── Computed ──────────────────────────────────────────────────────────────
  const { autoMatches, partialMatches, noMatches } = useMemo(() => {
    if (!preview) return { autoMatches: [], partialMatches: [], noMatches: [] }
    const auto = preview.matches.filter(m => m.auto_match && m.local_patient_id)
    const partial = preview.matches.filter(m => !m.auto_match && m.local_patient_id)
    const none = preview.matches.filter(m => !m.local_patient_id)
    return { autoMatches: auto, partialMatches: partial, noMatches: none }
  }, [preview])

  const pendingLinks = useMemo(() => {
    if (!preview) return []
    return preview.matches
      .filter(m => accepted[m.cosium_id] && m.local_patient_id)
      .map(m => ({ local_id: m.local_patient_id!, cosium_id: m.cosium_id }))
  }, [preview, accepted])

  const toggleAll = (matches: CosiumSyncMatch[], value: boolean) => {
    const update: Record<string, boolean> = {}
    matches.forEach(m => { if (m.local_patient_id) update[m.cosium_id] = value })
    setAccepted(prev => ({ ...prev, ...update }))
  }

  function MatchTable({ matches, title, color }: { matches: CosiumSyncMatch[]; title: string; color: string }) {
    if (!matches.length) return null
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">{title} <span className="text-gray-400">({matches.length})</span></h3>
          <div className="flex gap-2">
            <button className="text-xs text-brand-600 hover:underline" onClick={() => toggleAll(matches, true)}>Tout accepter</button>
            <span className="text-gray-300">·</span>
            <button className="text-xs text-gray-500 hover:underline" onClick={() => toggleAll(matches, false)}>Tout refuser</button>
          </div>
        </div>
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">✓</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Patient Cosium</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Patient local</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Confiance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {matches.map(m => (
                <tr key={m.cosium_id} className={accepted[m.cosium_id] ? 'bg-green-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!accepted[m.cosium_id]}
                      onChange={e => setAccepted(prev => ({ ...prev, [m.cosium_id]: e.target.checked }))}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PatientCell p={m.cosium_patient as any} label={`ID Cosium: ${m.cosium_id}`} />
                  </td>
                  <td className="px-3 py-2">
                    <PatientCell p={m.local_patient as any} />
                  </td>
                  <td className="px-3 py-2">
                    <ScoreBadge score={m.score} />
                  </td>
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
            <h2 className="text-lg font-bold text-gray-900">Synchronisation Cosium — base complète</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Associe automatiquement vos patients locaux à leurs fiches Cosium
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* ── Étape 1 : Idle ─────────────────────────────────────────────── */}
          {step === 'idle' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Link className="w-8 h-8 text-brand-600" />
              </div>
              <div className="text-center max-w-md">
                <p className="text-gray-700 font-medium">
                  Cette opération va comparer tous vos patients locaux avec la base Cosium et proposer des liaisons automatiques.
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  La correspondance se fait par numéro de sécurité sociale, puis par nom/prénom/date de naissance.
                  Vous validerez chaque liaison avant qu'elle soit enregistrée.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Patients Cosium à analyser :</label>
                <select
                  value={maxCosium}
                  onChange={e => setMaxCosium(Number(e.target.value))}
                  className="input w-32"
                >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
              <button
                className="btn-primary px-8"
                onClick={() => { setStep('loading'); previewMutation.mutate() }}
              >
                Lancer l'analyse
              </button>
              {previewMutation.isError && (
                <p className="text-sm text-red-500">
                  Erreur de connexion Cosium. Vérifiez que COSIUM_URL, COSIUM_USERNAME et COSIUM_PASSWORD sont configurés.
                </p>
              )}
            </div>
          )}

          {/* ── Étape 2 : Loading ──────────────────────────────────────────── */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
              <p className="text-gray-600">Récupération des patients Cosium en cours…</p>
              <p className="text-gray-400 text-sm">Cela peut prendre quelques secondes</p>
            </div>
          )}

          {/* ── Étape 3 : Preview ──────────────────────────────────────────── */}
          {step === 'preview' && preview && (
            <>
              {/* Résumé */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Patients Cosium analysés', value: preview.total_cosium, color: 'blue' },
                  { label: 'Correspondances exactes', value: autoMatches.length, color: 'green' },
                  { label: 'Correspondances probables', value: partialMatches.length, color: 'yellow' },
                  { label: 'Sans correspondance', value: noMatches.length + preview.unmatched_local.length, color: 'gray' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`p-3 rounded-xl bg-${color}-50 border border-${color}-100`}>
                    <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
                    <div className={`text-xs text-${color}-600 mt-0.5`}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tables de matches */}
              <div className="max-h-[50vh] overflow-y-auto pr-1">
                {autoMatches.length > 0 && (
                  <MatchTable matches={autoMatches} title="✅ Correspondances exactes (auto-acceptées)" color="green" />
                )}
                {partialMatches.length > 0 && (
                  <MatchTable matches={partialMatches} title="⚠️ Correspondances probables (à confirmer)" color="yellow" />
                )}
                {noMatches.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      ❌ Patients Cosium sans correspondance locale ({noMatches.length})
                    </h3>
                    <p className="text-xs text-gray-400 mb-2">Ces patients existent dans Cosium mais pas dans votre base locale. Ils ne seront pas liés automatiquement.</p>
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-50">
                          {noMatches.map(m => (
                            <tr key={m.cosium_id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <PatientCell p={m.cosium_patient as any} label={`ID: ${m.cosium_id}`} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Patients locaux sans Cosium */}
                {preview.unmatched_local.length > 0 && (
                  <div>
                    <button
                      className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-2"
                      onClick={() => setShowUnmatched(v => !v)}
                    >
                      {showUnmatched ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Patients locaux sans fiche Cosium ({preview.unmatched_local.length})
                    </button>
                    {showUnmatched && (
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-gray-50">
                            {preview.unmatched_local.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <PatientCell p={p as any} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-brand-600">{pendingLinks.length}</span> liaison{pendingLinks.length > 1 ? 's' : ''} à enregistrer
                </div>
                <div className="flex gap-3">
                  <button className="btn-secondary" onClick={() => setStep('idle')}>
                    Recommencer
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

          {/* ── Étape 4 : Applying ─────────────────────────────────────────── */}
          {step === 'applying' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
              <p className="text-gray-600">Enregistrement des liaisons…</p>
            </div>
          )}

          {/* ── Étape 5 : Done ─────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{result.applied} patient{result.applied > 1 ? 's' : ''} lié{result.applied > 1 ? 's' : ''} à Cosium !</p>
                <p className="text-gray-500 text-sm mt-1">
                  Les données Cosium (appareils, devis, RDV) sont maintenant accessibles depuis chaque fiche patient.
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
