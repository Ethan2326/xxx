import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentsAPI, patientsAPI, type AppointmentWithPatient, type AiSlotSuggestion } from '@/services/api'
import { useAuthStore } from '@/store'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Sparkles,
  Clock, User, Loader2, Trash2, AlertCircle
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Patient } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  premier_appareillage: 'Premier appareillage',
  essai: 'Essai',
  adaptation: 'Adaptation',
  suivi: 'Suivi',
  controle: 'Contrôle',
  sav: 'SAV',
  bilan: 'Bilan',
  renouvellement: 'Renouvellement',
}

const TYPE_COLORS: Record<string, string> = {
  premier_appareillage: 'bg-purple-100 text-purple-800 border-purple-300',
  essai: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  adaptation: 'bg-blue-100 text-blue-800 border-blue-300',
  suivi: 'bg-green-100 text-green-800 border-green-300',
  controle: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  sav: 'bg-red-100 text-red-800 border-red-300',
  bilan: 'bg-orange-100 text-orange-800 border-orange-300',
  renouvellement: 'bg-teal-100 text-teal-800 border-teal-300',
}

const TYPE_DURATIONS: Record<string, number> = {
  premier_appareillage: 90,
  essai: 60,
  adaptation: 45,
  suivi: 30,
  controle: 30,
  sav: 20,
  bilan: 60,
  renouvellement: 60,
}

// ── Modale création RDV ───────────────────────────────────────────────────────
function NewRdvModal({
  patients,
  initialDate,
  userId,
  onClose,
  onCreated,
}: {
  patients: Patient[]
  initialDate: Date
  userId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    patient_id: '',
    type: 'suivi',
    date: format(initialDate, 'yyyy-MM-dd'),
    heure: '09:00',
    salle: '',
    notes: '',
  })

  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{ suggestions: AiSlotSuggestion[]; ai_message: string } | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AiSlotSuggestion | null>(null)

  const duree = TYPE_DURATIONS[form.type] || 30

  const createMutation = useMutation({
    mutationFn: () => {
      let debut: string
      let fin: string
      if (selectedSlot) {
        debut = selectedSlot.debut
        fin = selectedSlot.fin
      } else {
        const d = new Date(`${form.date}T${form.heure}:00`)
        const f = new Date(d.getTime() + duree * 60000)
        debut = d.toISOString()
        fin = f.toISOString()
      }
      return appointmentsAPI.create({
        patient_id: form.patient_id,
        user_id: userId,
        type: form.type,
        debut,
        fin,
        salle: form.salle || undefined,
        notes: form.notes || undefined,
      }).then(r => r.data)
    },
    onSuccess: () => { onCreated(); onClose() },
  })

  const handleAiSuggest = async () => {
    if (!form.patient_id) return
    setAiLoading(true)
    setAiResult(null)
    setSelectedSlot(null)
    try {
      const { data } = await appointmentsAPI.aiSuggest({
        patient_id: form.patient_id,
        type_rdv: form.type,
        date_souhaitee: form.date,
        nb_suggestions: 3,
      })
      setAiResult(data)
    } catch {
      // ignore
    } finally {
      setAiLoading(false)
    }
  }

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setSelectedSlot(null)
    setAiResult(null)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Nouveau rendez-vous</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
            <select value={form.patient_id} onChange={e => set('patient_id', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sélectionner un patient…</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.last_name.toUpperCase()} {p.first_name}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de rendez-vous</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <button key={key} type="button"
                  onClick={() => set('type', key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${form.type === key
                    ? `${TYPE_COLORS[key]} border-2 font-bold`
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {label} <span className="opacity-60">({TYPE_DURATIONS[key]}min)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date/heure manuelle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure</label>
              <input type="time" value={form.heure} onChange={e => set('heure', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* AI suggestion */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">Créneaux suggérés par l'IA</span>
              </div>
              <button
                onClick={handleAiSuggest}
                disabled={!form.patient_id || aiLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {aiLoading ? 'Analyse…' : 'Suggérer'}
              </button>
            </div>

            {aiResult && (
              <div className="space-y-2">
                {aiResult.ai_message && (
                  <div className="flex gap-2 text-xs text-blue-800 bg-blue-100/60 rounded-lg p-2">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{aiResult.ai_message}</span>
                  </div>
                )}
                {aiResult.suggestions.map((slot, i) => (
                  <button key={i} type="button"
                    onClick={() => setSelectedSlot(selectedSlot?.debut === slot.debut ? null : slot)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                      selectedSlot?.debut === slot.debut
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-white border-gray-200 hover:border-blue-300 text-gray-800'
                    }`}>
                    <span className="capitalize">{slot.label}</span>
                  </button>
                ))}
              </div>
            )}
            {!aiResult && !aiLoading && (
              <p className="text-xs text-blue-600 opacity-70">
                Sélectionnez un patient pour analyser ses disponibilités et l'historique de soins.
              </p>
            )}
          </div>

          {/* Salle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salle (optionnel)</label>
            <input type="text" placeholder="Salle 1, Cabine audiométrie…" value={form.salle} onChange={e => set('salle', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Informations particulières…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.patient_id || createMutation.isPending}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? 'Enregistrement…' : 'Créer le RDV'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modale détail RDV ─────────────────────────────────────────────────────────
function RdvDetailModal({ appt, onClose, onDelete }: {
  appt: AppointmentWithPatient
  onClose: () => void
  onDelete: () => void
}) {
  const deleteMutation = useMutation({
    mutationFn: () => appointmentsAPI.delete(appt.id).then(r => r.data),
    onSuccess: () => { onDelete(); onClose() },
  })

  const colors = TYPE_COLORS[appt.type] || 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className={`rounded-t-2xl p-4 border-b ${colors}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">{TYPE_LABELS[appt.type] || appt.type}</span>
            <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-900">{appt.patient_nom || 'Patient'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">
              {format(new Date(appt.debut), 'EEEE d MMMM', { locale: fr })} — {format(new Date(appt.debut), 'HH:mm')} › {format(new Date(appt.fin), 'HH:mm')}
              <span className="text-gray-400 ml-2">({appt.duree_minutes} min)</span>
            </span>
          </div>
          {appt.salle && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">📍 {appt.salle}</div>
          )}
          {appt.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{appt.notes}</div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Statut :</span>
            <span className="text-xs font-semibold text-gray-700 capitalize">{appt.statut}</span>
          </div>
        </div>
        <div className="flex justify-between gap-3 p-5 border-t">
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
            {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200">Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [showNewRdv, setShowNewRdv] = useState(false)
  const [initialDate, setInitialDate] = useState(new Date())
  const [selectedAppt, setSelectedAppt] = useState<AppointmentWithPatient | null>(null)

  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: () => appointmentsAPI.list({
      date_debut: format(weekStart, 'yyyy-MM-dd'),
      date_fin: format(weekEnd, 'yyyy-MM-dd'),
    }).then(r => r.data),
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsAPI.list().then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['appointments'] })

  const getApptForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return appointments.filter(a => a.debut.startsWith(dayStr)).sort((a, b) => a.debut.localeCompare(b.debut))
  }

  const openNewRdvOnDay = (day: Date) => {
    setInitialDate(day)
    setShowNewRdv(true)
  }

  // Compte du jour
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayAppts = appointments.filter(a => a.debut.startsWith(todayStr))

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-500 text-sm">
            {format(weekStart, 'd MMMM', { locale: fr })} — {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
            {todayAppts.length > 0 && (
              <span className="ml-3 inline-flex px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                {todayAppts.length} RDV aujourd'hui
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700" onClick={() => setCurrentWeek(new Date())}>
            Aujourd'hui
          </button>
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setInitialDate(new Date()); setShowNewRdv(true) }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nouveau RDV
          </button>
        </div>
      </div>

      {/* Grille semaine */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* En-têtes jours */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {weekDays.map((day) => {
            const isToday = format(day, 'yyyy-MM-dd') === todayStr
            const dayAppts = getApptForDay(day)
            return (
              <div key={day.toISOString()} className={`p-3 text-center border-r border-gray-100 last:border-0 ${isToday ? 'bg-blue-50' : ''}`}>
                <div className="text-xs text-gray-500 uppercase font-medium">{format(day, 'EEE', { locale: fr })}</div>
                <button
                  onClick={() => openNewRdvOnDay(day)}
                  className={`w-8 h-8 mx-auto mt-1 flex items-center justify-center rounded-full font-bold text-sm transition-colors hover:bg-blue-100 ${isToday ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </button>
                {dayAppts.length > 0 && (
                  <div className={`text-xs mt-1 font-semibold ${isToday ? 'text-blue-700' : 'text-gray-500'}`}>
                    {dayAppts.length} RDV
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Corps semaine */}
        <div className="grid grid-cols-7 min-h-[500px]">
          {weekDays.map((day) => {
            const dayAppts = getApptForDay(day)
            const isToday = format(day, 'yyyy-MM-dd') === todayStr
            return (
              <div
                key={day.toISOString()}
                className={`border-r border-gray-100 last:border-0 p-2 space-y-1.5 cursor-pointer group ${isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}
                onClick={() => openNewRdvOnDay(day)}
              >
                {dayAppts.length === 0 && (
                  <div className="h-full flex items-start justify-center pt-4">
                    <span className="text-xs text-gray-300 group-hover:text-blue-300 transition-colors">+ RDV</span>
                  </div>
                )}
                {dayAppts.map(a => (
                  <div
                    key={a.id}
                    onClick={e => { e.stopPropagation(); setSelectedAppt(a) }}
                    className={`p-2 rounded-lg border text-xs cursor-pointer hover:opacity-90 transition-opacity ${TYPE_COLORS[a.type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    <div className="font-bold">{format(new Date(a.debut), 'HH:mm')}</div>
                    <div className="mt-0.5 font-medium line-clamp-1">{TYPE_LABELS[a.type] ?? a.type}</div>
                    {a.patient_nom && (
                      <div className="mt-0.5 opacity-80 line-clamp-1 text-xs">{a.patient_nom}</div>
                    )}
                    {a.salle && <div className="opacity-60 text-xs">{a.salle}</div>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key} className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[key]}`}>{label}</span>
        ))}
      </div>

      {/* Modales */}
      {showNewRdv && user && (
        <NewRdvModal
          patients={patients}
          initialDate={initialDate}
          userId={user.id}
          onClose={() => setShowNewRdv(false)}
          onCreated={invalidate}
        />
      )}
      {selectedAppt && (
        <RdvDetailModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onDelete={invalidate}
        />
      )}
    </div>
  )
}
