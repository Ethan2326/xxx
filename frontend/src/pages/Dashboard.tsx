import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { patientsAPI, appointmentsAPI, billingAPI, integrationsAPI } from '@/services/api'
import {
  Users, Calendar, TrendingUp, RefreshCw, Brain, AlertCircle,
  CheckCircle2, Clock, UserPlus, FileText, ReceiptText, Wifi, WifiOff,
  ChevronRight, Star, Sparkles
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, differenceInMonths, differenceInDays, isAfter, isBefore, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Patient } from '@/types'

function StatCard({
  title, value, sub, icon: Icon, color, onClick
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
  onClick?: () => void
}) {
  return (
    <div
      className={`card p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 ml-3 ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  bilan: 'Bilan',
  adaptation: 'Adaptation',
  controle: 'Contrôle',
  essai: 'Essai',
  sav: 'SAV',
  reglage: 'Réglage',
  premier_rdv: '1er RDV',
}

const APPOINTMENT_TYPE_COLORS: Record<string, string> = {
  bilan: 'bg-purple-100 text-purple-700',
  adaptation: 'bg-brand-100 text-brand-700',
  controle: 'bg-green-100 text-green-700',
  essai: 'bg-yellow-100 text-yellow-700',
  sav: 'bg-red-100 text-red-700',
  reglage: 'bg-indigo-100 text-indigo-700',
  premier_rdv: 'bg-teal-100 text-teal-700',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const today = format(new Date(), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsAPI.list().then(r => r.data),
  })

  const { data: todayAppointments } = useQuery({
    queryKey: ['appointments-today'],
    queryFn: () => appointmentsAPI.list({ date_debut: today, date_fin: today }).then(r => r.data),
  })

  const { data: monthAppointments } = useQuery({
    queryKey: ['appointments-month'],
    queryFn: () => appointmentsAPI.list({ date_debut: monthStart, date_fin: monthEnd }).then(r => r.data),
  })

  const { data: billingStats } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => billingAPI.stats().then(r => r.data),
  })

  const { data: allDevis } = useQuery({
    queryKey: ['devis-all'],
    queryFn: () => billingAPI.listDevis().then(r => r.data),
  })

  const { data: integrations } = useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => integrationsAPI.status().then(r => r.data),
    refetchInterval: 30_000,
  })

  const patientMap = new Map<string, Patient>()
  patients?.forEach(p => patientMap.set(p.id, p))

  const getPatientName = (patientId: string) => {
    const p = patientMap.get(patientId)
    if (!p) return patientId.slice(0, 8) + '…'
    return `${p.last_name.toUpperCase()} ${p.first_name}`
  }

  const now = new Date()

  const renewalPatients = (patients ?? []).filter(p => {
    const ageMonths = differenceInMonths(now, parseISO(p.created_at))
    return ageMonths >= 48
  })

  const devisPending = (allDevis ?? []).filter(d => d.statut === 'envoye' || d.statut === 'brouillon')

  const patientsWithoutRecentRdv = (() => {
    if (!patients || !monthAppointments) return 0
    const activePatientIds = new Set(
      (monthAppointments ?? [])
        .filter(a => {
          const diff = differenceInDays(now, parseISO(a.debut))
          return diff <= 180
        })
        .map(a => a.patient_id)
    )
    return patients.filter(p => !activePatientIds.has(p.id)).length
  })()

  const nextTodayRdv = (todayAppointments ?? [])
    .filter(a => isAfter(parseISO(a.debut), now) || differenceInDays(parseISO(a.debut), now) === 0)
    .sort((a, b) => parseISO(a.debut).getTime() - parseISO(b.debut).getTime())[0]

  const caMonth = billingStats?.total_factures_ttc

  const aiInsights = [
    {
      icon: Sparkles,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      text: todayAppointments
        ? `Bonne journée ! Vous avez ${todayAppointments.length} rendez-vous aujourd'hui.${nextTodayRdv ? ` Prochain : ${format(parseISO(nextTodayRdv.debut), 'HH:mm')}` : ''}`
        : 'Chargement de votre agenda…',
    },
    {
      icon: AlertCircle,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
      text: devisPending.length > 0
        ? `${devisPending.length} devis en attente de réponse (envoyé ou brouillon).`
        : 'Aucun devis en attente de réponse.',
    },
    {
      icon: RefreshCw,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      text: renewalPatients.length > 0
        ? `Renouvellements potentiels : ${renewalPatients.slice(0, 3).map(p => `${p.last_name} ${p.first_name}`).join(', ')}${renewalPatients.length > 3 ? ` +${renewalPatients.length - 3} autres` : ''}.`
        : 'Aucun renouvellement imminent détecté.',
    },
    {
      icon: Users,
      color: 'text-red-500',
      bg: 'bg-red-50',
      text: `${patientsWithoutRecentRdv} patient(s) sans rendez-vous récent — pensez à les recontacter.`,
    },
  ]

  const recentActivities = [
    ...(patients ?? []).slice(0, 2).map(p => ({
      icon: UserPlus,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      text: `Nouveau patient : ${p.last_name.toUpperCase()} ${p.first_name}`,
      date: p.created_at,
    })),
    ...(allDevis ?? []).slice(0, 2).map(d => ({
      icon: FileText,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      text: `Devis ${d.numero} — ${d.montant_ttc !== undefined ? d.montant_ttc?.toFixed(2) + ' €' : '—'}`,
      date: d.created_at,
    })),
    ...(todayAppointments ?? []).slice(0, 2).map(a => ({
      icon: Calendar,
      color: 'text-green-600',
      bg: 'bg-green-50',
      text: `RDV : ${getPatientName(a.patient_id)} à ${format(parseISO(a.debut), 'HH:mm')}`,
      date: a.created_at,
    })),
  ]
    .filter(a => !!a.date)
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-500 mt-1 capitalize">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {integrations && Object.values(integrations).some(i => i.connected) && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2.5 py-1.5 rounded-full">
              <Wifi className="w-3.5 h-3.5" />
              Systèmes connectés
            </span>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Patients actifs"
          value={patients?.length ?? '—'}
          sub={patients ? `${patients.length} dossiers au total` : undefined}
          icon={Users}
          color="bg-brand-600"
          onClick={() => navigate('/patients')}
        />
        <StatCard
          title="RDV aujourd'hui"
          value={todayAppointments?.length ?? '—'}
          sub={nextTodayRdv ? `Prochain à ${format(parseISO(nextTodayRdv.debut), 'HH:mm')}` : 'Aucun à venir'}
          icon={Calendar}
          color="bg-green-600"
        />
        <StatCard
          title="CA du mois"
          value={caMonth !== undefined ? `${caMonth.toFixed(0)} €` : '—'}
          sub={billingStats ? `${billingStats.nb_factures} facture(s) émise(s)` : undefined}
          icon={ReceiptText}
          color="bg-orange-500"
          onClick={() => navigate('/billing')}
        />
        <StatCard
          title="Renouvellements 30j"
          value={renewalPatients.length}
          sub="Appareils > 4 ans"
          icon={RefreshCw}
          color="bg-purple-600"
        />
      </div>

      {/* Insights IA */}
      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900">Insights IA du jour</h2>
          <span className="ml-auto badge bg-purple-100 text-purple-700 text-xs">Analyse automatique</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {aiInsights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${insight.bg}`}>
              <insight.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${insight.color}`} />
              <p className="text-sm text-gray-700">{insight.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RDV du jour */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Rendez-vous du jour</h2>
            <span className="text-xs text-gray-400">
              {todayAppointments?.length ?? 0} RDV
            </span>
          </div>
          <div className="p-4">
            {todayAppointments && todayAppointments.length > 0 ? (
              <ul className="space-y-2">
                {todayAppointments.map(a => {
                  const typeKey = a.type?.toLowerCase().replace(/\s/g, '_') ?? ''
                  const typeLabel = APPOINTMENT_TYPE_LABELS[typeKey] ?? a.type
                  const typeColor = APPOINTMENT_TYPE_COLORS[typeKey] ?? 'bg-gray-100 text-gray-600'
                  const isPast = isBefore(parseISO(a.fin), now)
                  return (
                    <li
                      key={a.id}
                      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl border transition-colors ${
                        isPast ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-100 hover:border-brand-200 hover:bg-brand-50/30'
                      }`}
                    >
                      <div className="text-sm font-bold text-brand-600 w-12 flex-shrink-0 tabular-nums">
                        {format(parseISO(a.debut), 'HH:mm')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">
                          {patientMap.size > 0 ? getPatientName(a.patient_id) : '…'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`badge text-xs ${typeColor}`}>{typeLabel}</span>
                          {a.salle && (
                            <span className="text-xs text-gray-400">{a.salle}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`badge text-xs ${
                          a.statut === 'confirme' ? 'bg-green-100 text-green-700' :
                          a.statut === 'planifie' ? 'bg-blue-100 text-blue-700' :
                          a.statut === 'annule' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {a.statut}
                        </span>
                        {patientMap.has(a.patient_id) && (
                          <button
                            className="text-xs text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap"
                            onClick={() => navigate(`/patients/${a.patient_id}`)}
                          >
                            Voir →
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-gray-400 text-sm">Aucun rendez-vous aujourd'hui</p>
              </div>
            )}
          </div>
        </div>

        {/* Flux d'activités récentes */}
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Activité récente</h2>
            <Clock className="w-4 h-4 text-gray-300" />
          </div>
          <div className="p-4">
            {recentActivities.length > 0 ? (
              <ul className="space-y-3">
                {recentActivities.map((activity, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.bg}`}>
                      <activity.icon className={`w-3.5 h-3.5 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{activity.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(parseISO(activity.date), "d MMM 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">Aucune activité récente</p>
            )}
          </div>
        </div>
      </div>

      {/* Devis en attente + Statut intégrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devis en attente */}
        {devisPending.length > 0 && (
          <div className="card">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Devis en attente</h2>
              <button
                className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                onClick={() => navigate('/billing')}
              >
                Voir tous →
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {devisPending.slice(0, 5).map(d => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <FileText className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.numero}</p>
                    <p className="text-xs text-gray-400">
                      {format(parseISO(d.date_devis), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {d.montant_ttc !== undefined ? `${d.montant_ttc.toFixed(0)} €` : '—'}
                    </p>
                    <span className={`badge text-xs ${
                      d.statut === 'envoye' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{d.statut}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statut intégrations */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Statut des intégrations</h2>
          </div>
          <div className="p-4 space-y-2">
            {integrations ? (
              Object.entries(integrations).map(([key, info]) => (
                <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">{info.label}</span>
                  <div className={`flex items-center gap-1.5 text-sm font-medium ${
                    info.connected ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {info.connected
                      ? <><Wifi className="w-4 h-4" /> Connecté</>
                      : <><WifiOff className="w-4 h-4" /> Déconnecté</>
                    }
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm py-4 text-center">Vérification en cours…</p>
            )}
          </div>
        </div>
      </div>

      {/* Renouvellements */}
      {renewalPatients.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-purple-500" />
              <h2 className="font-semibold text-gray-900">Patients à renouveler</h2>
              <span className="badge bg-purple-100 text-purple-700">{renewalPatients.length}</span>
            </div>
            <button
              className="text-xs text-brand-600 hover:text-brand-800 font-medium"
              onClick={() => navigate('/patients')}
            >
              Voir tous →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Ancienneté</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Mutuelle</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {renewalPatients.slice(0, 8).map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.last_name.toUpperCase()} {p.first_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {differenceInMonths(now, parseISO(p.created_at))} mois
                    </td>
                    <td className="px-4 py-3">
                      {p.mutuelle
                        ? <span className="badge bg-green-100 text-green-700">{p.mutuelle}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
