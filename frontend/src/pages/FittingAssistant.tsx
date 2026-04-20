import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fittingAPI, patientsAPI } from '@/services/api'
import { Sliders, Play, Loader2, Volume2, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import type { FittingSituation, Patient } from '@/types'
import ReactMarkdown from 'react-markdown'

const NIVEAU_COLORS = (db: number) => {
  if (db < 50) return 'bg-green-100 text-green-700'
  if (db < 65) return 'bg-yellow-100 text-yellow-700'
  if (db < 75) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

export default function FittingAssistantPage() {
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedSituation, setSelectedSituation] = useState<FittingSituation | null>(null)
  const [feedback, setFeedback] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsAPI.list().then(r => r.data),
  })

  const { data: situations } = useQuery({
    queryKey: ['situations'],
    queryFn: () => fittingAPI.getSituations().then(r => r.data),
  })

  const startSession = useMutation({
    mutationFn: (patientId: string) => fittingAPI.createSession({ patient_id: patientId }).then(r => r.data),
    onSuccess: (data) => setSessionId(data.id),
  })

  const getRecommendation = useMutation({
    mutationFn: (data: { situation_key: string; feedback_patient: string }) =>
      fittingAPI.getAiRecommendation({
        patient_id: selectedPatientId,
        session_id: sessionId!,
        situation_key: data.situation_key,
        feedback_patient: data.feedback_patient,
      }).then(r => r.data),
    onSuccess: (data) => setRecommendation(data.recommendation),
  })

  const handleStartSession = () => {
    if (!selectedPatientId) return
    startSession.mutate(selectedPatientId)
  }

  const handleAskAI = () => {
    if (!selectedSituation || !sessionId) return
    getRecommendation.mutate({
      situation_key: selectedSituation.key,
      feedback_patient: feedback,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assistant Réglage IA</h1>
        <p className="text-gray-500 mt-1">
          {situations?.total ?? '…'} situations pré-enregistrées — Recommandations personnalisées par IA
        </p>
      </div>

      {/* Sélection patient + démarrage session */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Session de réglage</h2>
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Patient</label>
            <select
              className="input"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              disabled={!!sessionId}
            >
              <option value="">Sélectionner un patient…</option>
              {patients?.map((p: Patient) => (
                <option key={p.id} value={p.id}>
                  {p.last_name.toUpperCase()} {p.first_name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-primary"
            onClick={handleStartSession}
            disabled={!selectedPatientId || !!sessionId || startSession.isPending}
          >
            {startSession.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Démarrage…</>
              : <><Play className="w-4 h-4" />Démarrer la session</>
            }
          </button>
          {sessionId && (
            <div className="badge bg-green-100 text-green-700 px-3 py-1.5 text-sm">
              ✓ Session active
            </div>
          )}
        </div>
      </div>

      {sessionId && situations && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Situations */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-brand-600" />
                Situations de vie
              </h2>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {Object.entries(situations.categories).map(([category, items]) => (
                <div key={category}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  >
                    <span className="text-sm font-semibold text-gray-700">{category}</span>
                    {expandedCategory === category
                      ? <ChevronUp className="w-4 h-4 text-gray-500" />
                      : <ChevronDown className="w-4 h-4 text-gray-500" />
                    }
                  </button>
                  {expandedCategory === category && (
                    <ul>
                      {(items as FittingSituation[]).map((s) => (
                        <li key={s.key}>
                          <button
                            className={`w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors border-b border-gray-50 ${
                              selectedSituation?.key === s.key ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''
                            }`}
                            onClick={() => {
                              setSelectedSituation(s)
                              setRecommendation('')
                              setFeedback('')
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-800">{s.label}</span>
                              <span className={`badge text-xs ${NIVEAU_COLORS(s.niveau_bruit_moyen_db)}`}>
                                {s.niveau_bruit_moyen_db} dB
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.description}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panneau IA */}
          <div className="space-y-4">
            {selectedSituation ? (
              <>
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-800 mb-1">{selectedSituation.label}</h3>
                  <p className="text-sm text-gray-500 mb-4">{selectedSituation.description}</p>

                  <div className="mb-4">
                    <label className="label">Retour du patient</label>
                    <textarea
                      className="input resize-none"
                      rows={3}
                      placeholder="Décrivez le retour du patient dans cette situation (difficultés, gênes, souhaits…)"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn-primary w-full justify-center"
                    onClick={handleAskAI}
                    disabled={getRecommendation.isPending}
                  >
                    {getRecommendation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Analyse en cours…</>
                      : <><Lightbulb className="w-4 h-4" />Obtenir une recommandation IA</>
                    }
                  </button>
                </div>

                {/* Conseils par défaut */}
                <div className="card p-5 bg-amber-50 border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2">Conseils de base pour cette situation</h4>
                  <p className="text-sm text-amber-700">{selectedSituation.conseils}</p>
                </div>

                {/* Recommandation IA */}
                {recommendation && (
                  <div className="card p-5 bg-brand-50 border-brand-200">
                    <h4 className="text-sm font-semibold text-brand-800 mb-3 flex items-center gap-2">
                      <Sliders className="w-4 h-4" />
                      Recommandation IA personnalisée
                    </h4>
                    <div className="prose prose-sm max-w-none text-brand-900">
                      <ReactMarkdown>{recommendation}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card p-12 text-center">
                <Sliders className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">Sélectionnez une situation pour obtenir des recommandations de réglage</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!sessionId && (
        <div className="card p-12 text-center">
          <Sliders className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-gray-500 font-medium">Démarrez une session de réglage</h3>
          <p className="text-gray-400 text-sm mt-1">Sélectionnez un patient et démarrez la session pour accéder aux situations</p>
        </div>
      )}
    </div>
  )
}
