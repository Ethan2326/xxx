import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Download, RefreshCw, CheckCircle, Users, AlertTriangle } from 'lucide-react'
import api from '@/services/api'

interface Props { onClose: () => void }

interface Preview {
  total_cosium: number
  to_create: number
  to_skip: number
  no_birth_date: number
  total_local: number
  samples: { cosium_id: string; last_name: string; first_name: string; birth_date: string }[]
}

interface ImportResult {
  created: number
  linked: number
  skipped: number
  errors: string[]
  total_cosium: number
}

type Step = 'idle' | 'previewing' | 'preview' | 'importing' | 'done'

export default function CosiumImportModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [maxPatients, setMaxPatients] = useState(500)

  const previewMutation = useMutation({
    mutationFn: () =>
      api.get<Preview>('/integrations/cosium/import-all/preview', {
        params: { max_patients: maxPatients },
      }).then(r => r.data),
    onSuccess: (data) => { setPreview(data); setStep('preview') },
    onError: () => setStep('idle'),
  })

  const importMutation = useMutation({
    mutationFn: () =>
      api.post<ImportResult>('/integrations/cosium/import-all', null, {
        params: { max_patients: maxPatients },
      }).then(r => r.data),
    onSuccess: (data) => { setResult(data); setStep('done') },
    onError: () => setStep('preview'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Importer les patients Cosium</h2>
            <p className="text-sm text-gray-500 mt-0.5">Tous tes patients Cosium créés en un clic</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
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
                  <p className="font-semibold mb-1">Comment ça fonctionne</p>
                  <ul className="space-y-1 text-blue-700 list-disc list-inside">
                    <li>Récupère tous tes patients depuis Cosium</li>
                    <li>Les crée directement dans ta base locale</li>
                    <li>Ignore ceux déjà présents (pas de doublons)</li>
                    <li>Lie automatiquement si le NIR correspond</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 flex-shrink-0">Nombre max de patients :</label>
                <select
                  value={maxPatients}
                  onChange={e => setMaxPatients(Number(e.target.value))}
                  className="input w-32"
                >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1 000</option>
                  <option value={2000}>2 000</option>
                </select>
              </div>

              <button
                className="btn-primary w-full py-3 text-base"
                onClick={() => { setStep('previewing'); previewMutation.mutate() }}
              >
                Analyser ma base Cosium
              </button>

              {previewMutation.isError && (
                <div className="flex gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Connexion Cosium échouée. Vérifiez que COSIUM_URL, COSIUM_USERNAME et COSIUM_PASSWORD sont corrects dans Render.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Previewing ────────────────────────────────────────────────── */}
          {step === 'previewing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
              <p className="text-gray-600">Connexion à Cosium et analyse en cours…</p>
              <p className="text-gray-400 text-sm">Première connexion : 5 à 15 secondes</p>
            </div>
          )}

          {/* ── Preview ───────────────────────────────────────────────────── */}
          {step === 'preview' && preview && (
            <div className="space-y-5">
              {/* Chiffres */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-brand-50 border border-brand-100 text-center">
                  <div className="text-2xl font-bold text-brand-700">{preview.total_cosium}</div>
                  <div className="text-xs text-brand-600 mt-0.5">Patients Cosium</div>
                </div>
                <div className="p-3 rounded-xl bg-green-50 border border-green-100 text-center">
                  <div className="text-2xl font-bold text-green-700">{preview.to_create}</div>
                  <div className="text-xs text-green-600 mt-0.5">À importer</div>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <div className="text-2xl font-bold text-gray-500">{preview.to_skip}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Déjà présents</div>
                </div>
              </div>

              {preview.no_birth_date > 0 && (
                <div className="flex gap-2 p-3 bg-yellow-50 rounded-xl text-sm text-yellow-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {preview.no_birth_date} patient{preview.no_birth_date > 1 ? 's' : ''} sans date de naissance dans Cosium — ils seront ignorés.
                  </span>
                </div>
              )}

              {/* Aperçu des premiers patients */}
              {preview.samples.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Aperçu des premiers patients à importer :</p>
                  <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                    {preview.samples.map((s, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">
                          {s.last_name.toUpperCase()} {s.first_name}
                        </span>
                        <span className="text-gray-400 text-xs">{s.birth_date}</span>
                      </div>
                    ))}
                    {preview.to_create > preview.samples.length && (
                      <div className="px-3 py-2 text-xs text-gray-400 italic">
                        + {preview.to_create - preview.samples.length} autres…
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button className="btn-secondary flex-1" onClick={() => setStep('idle')}>
                  Annuler
                </button>
                <button
                  className="btn-primary flex-1 py-3"
                  disabled={preview.to_create === 0}
                  onClick={() => { setStep('importing'); importMutation.mutate() }}
                >
                  {preview.to_create === 0
                    ? 'Rien à importer'
                    : `Importer ${preview.to_create} patient${preview.to_create > 1 ? 's' : ''}`
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── Importing ─────────────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
              <p className="text-gray-600 font-medium">Import en cours…</p>
              <p className="text-gray-400 text-sm">Ne ferme pas cette fenêtre</p>
            </div>
          )}

          {/* ── Done ──────────────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-xl font-bold text-gray-900">Import terminé !</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-green-50 border border-green-100 text-center">
                  <div className="text-2xl font-bold text-green-700">{result.created}</div>
                  <div className="text-xs text-green-600 mt-0.5">Créés</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                  <div className="text-2xl font-bold text-blue-700">{result.linked}</div>
                  <div className="text-xs text-blue-600 mt-0.5">Liés (NIR)</div>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <div className="text-2xl font-bold text-gray-500">{result.skipped}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Ignorés</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-yellow-50 rounded-xl p-3">
                  <p className="text-sm font-semibold text-yellow-700 mb-1">
                    {result.errors.length} patient{result.errors.length > 1 ? 's' : ''} ignoré{result.errors.length > 1 ? 's' : ''} (données manquantes)
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-yellow-600">{e}</p>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn-primary w-full" onClick={onClose}>
                Voir mes patients
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
