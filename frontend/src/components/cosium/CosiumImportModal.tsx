import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Download, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import api from '@/services/api'

interface Props { onClose: () => void }

interface JobStatus {
  status: 'running' | 'done' | 'error'
  step?: string
  progress?: number
  total_cosium?: number
  created?: number
  linked?: number
  skipped?: number
  errors?: string[]
  error?: string
}

type Step = 'idle' | 'running' | 'done'

export default function CosiumImportModal({ onClose }: Props) {
  const [step, setStep]       = useState<Step>('idle')
  const [jobId, setJobId]     = useState<string | null>(null)
  const [jobStatus, setStatus] = useState<JobStatus | null>(null)
  const [maxPatients, setMax] = useState(500)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Démarrer l'import ─────────────────────────────────────────────────────
  const startMutation = useMutation({
    mutationFn: () =>
      api.post<{ job_id: string }>('/integrations/cosium/import-all/start', null, {
        params: { max_patients: maxPatients },
      }).then(r => r.data),
    onSuccess: ({ job_id }) => {
      setJobId(job_id)
      setStep('running')
    },
  })

  // ── Polling du statut ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'running' || !jobId) return

    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get<JobStatus>(`/integrations/cosium/import-all/status/${jobId}`)
        setStatus(r.data)
        if (r.data.status === 'done' || r.data.status === 'error') {
          clearInterval(pollRef.current!)
          setStep('done')
        }
      } catch { /* ignore */ }
    }, 2000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step, jobId])

  // ── Progress bar ──────────────────────────────────────────────────────────
  const pct = jobStatus?.total_cosium
    ? Math.round((jobStatus.progress ?? 0) / jobStatus.total_cosium * 100)
    : 0

  const stepLabel: Record<string, string> = {
    'démarrage': 'Démarrage…',
    'connexion': 'Connexion à Cosium (login Keycloak)…',
    'import': `Import en cours — ${jobStatus?.progress ?? 0} / ${jobStatus?.total_cosium ?? '?'} patients`,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Importer les patients Cosium</h2>
            <p className="text-sm text-gray-500 mt-0.5">Tous tes patients Cosium créés directement dans ta base</p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'running'}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* ── Idle ──────────────────────────────────────────────────────── */}
          {step === 'idle' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
                <Download className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <p className="font-semibold mb-1">Ce qui va se passer</p>
                  <ul className="space-y-1 text-blue-700 list-disc list-inside">
                    <li>Connexion automatique à Cosium</li>
                    <li>Récupération de tous tes patients</li>
                    <li>Création dans ta base locale avec toutes leurs infos</li>
                    <li>Pas de doublons — les existants sont ignorés</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 flex-shrink-0">Nombre max de patients :</label>
                <select value={maxPatients} onChange={e => setMax(Number(e.target.value))} className="input w-32">
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1 000</option>
                  <option value={2000}>2 000</option>
                </select>
              </div>

              <button
                className="btn-primary w-full py-3 text-base"
                disabled={startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                {startMutation.isPending
                  ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Démarrage…</span>
                  : 'Lancer l\'import'
                }
              </button>

              {startMutation.isError && (
                <div className="flex gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Erreur de connexion. Vérifiez COSIUM_URL, COSIUM_USERNAME et COSIUM_PASSWORD dans Render.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Running ───────────────────────────────────────────────────── */}
          {step === 'running' && (
            <div className="space-y-5 py-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-6 h-6 text-brand-500 animate-spin flex-shrink-0" />
                <p className="text-gray-700 font-medium">
                  {stepLabel[jobStatus?.step ?? 'démarrage'] ?? jobStatus?.step ?? 'En cours…'}
                </p>
              </div>

              {/* Barre de progression */}
              {(jobStatus?.total_cosium ?? 0) > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{jobStatus?.progress} patients traités</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Total Cosium : {jobStatus?.total_cosium} patients</p>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Ne ferme pas cette fenêtre · Mise à jour toutes les 2 secondes
              </p>
            </div>
          )}

          {/* ── Done ──────────────────────────────────────────────────────── */}
          {step === 'done' && jobStatus && (
            <div className="space-y-5">
              {jobStatus.status === 'error' ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <AlertTriangle className="w-12 h-12 text-red-400" />
                  <p className="font-semibold text-gray-800">Erreur pendant l'import</p>
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 w-full">{jobStatus.error}</p>
                  <button className="btn-secondary" onClick={() => { setStep('idle'); setStatus(null) }}>
                    Réessayer
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-xl font-bold text-gray-900">Import terminé !</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Créés', value: jobStatus.created ?? 0, color: 'green' },
                      { label: 'Liés (NIR)', value: jobStatus.linked ?? 0, color: 'blue' },
                      { label: 'Ignorés', value: jobStatus.skipped ?? 0, color: 'gray' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`p-3 rounded-xl bg-${color}-50 border border-${color}-100 text-center`}>
                        <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
                        <div className={`text-xs text-${color}-600 mt-0.5`}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {(jobStatus.errors ?? []).length > 0 && (
                    <div className="bg-yellow-50 rounded-xl p-3">
                      <p className="text-sm font-semibold text-yellow-700 mb-1">
                        {jobStatus.errors!.length} patient{jobStatus.errors!.length > 1 ? 's' : ''} ignoré{jobStatus.errors!.length > 1 ? 's' : ''}
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {jobStatus.errors!.map((e, i) => (
                          <p key={i} className="text-xs text-yellow-600">{e}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className="btn-primary w-full" onClick={onClose}>
                    Voir mes patients →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
