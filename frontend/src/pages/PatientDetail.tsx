import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { patientsAPI, reportsAPI, fittingAPI, billingAPI, appointmentsAPI } from '@/services/api'
import {
  ArrowLeft, User, Ear, FileText, Sliders, ShieldCheck,
  Calendar, Phone, Mail, MapPin, ChevronRight, Edit3, Link,
  Sparkles, Receipt, Download, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react'
import { format, differenceInMonths, differenceInDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import PECPanel from '@/components/pec/PECPanel'
import CosiumPanel from '@/components/cosium/CosiumPanel'
import type { Patient } from '@/types'

// ─── Audiogramme mini-tableau ─────────────────────────────────────────────────
const FREQUENCIES = ['250', '500', '1000', '2000', '3000', '4000', '6000', '8000']

function AudiogramTable({ seuils, label }: { seuils: Record<string, number> | undefined | null; label: string }) {
  if (!seuils) return <span className="text-gray-400 text-xs">Non renseigné</span>
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex gap-1.5">
        {FREQUENCIES.map(f => (
          <div key={f} className="flex flex-col items-center">
            <span className="text-[10px] text-gray-400 mb-0.5">
              {parseInt(f) >= 1000 ? `${parseInt(f) / 1000}k` : f}
            </span>
            <span className={`text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center ${
              seuils[f] === undefined
                ? 'text-gray-300 bg-gray-50'
                : seuils[f] < 25
                ? 'text-green-700 bg-green-50'
                : seuils[f] < 40
                ? 'text-yellow-700 bg-yellow-50'
                : seuils[f] < 55
                ? 'text-orange-600 bg-orange-50'
                : seuils[f] < 70
                ? 'text-red-600 bg-red-50'
                : 'text-red-800 bg-red-100'
            }`}>
              {seuils[f] !== undefined ? seuils[f] : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Onglets ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'synthese',      label: 'Synthèse',            icon: Sparkles },
  { id: 'informations',  label: 'Informations',        icon: User },
  { id: 'audiogrammes',  label: 'Audiogrammes',        icon: Ear },
  { id: 'appareils',     label: 'Appareils',           icon: Ear },
  { id: 'pec',           label: 'Prises en charge',    icon: ShieldCheck },
  { id: 'comptes_rendus',label: 'Comptes rendus',      icon: FileText },
  { id: 'facturation',   label: 'Facturation',         icon: Receipt },
  { id: 'reglage',       label: 'Réglage IA',          icon: Sliders },
  { id: 'cosium',        label: 'Cosium',              icon: Link },
] as const

type TabId = typeof TABS[number]['id']

// ─── Page principale ──────────────────────────────────────────────────────────
export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('synthese')

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsAPI.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: audiograms } = useQuery({
    queryKey: ['patient-audiograms', id],
    queryFn: () => patientsAPI.getAudiograms(id!).then(r => r.data),
    enabled: !!id && (activeTab === 'audiogrammes' || activeTab === 'synthese'),
  })

  const { data: devices } = useQuery({
    queryKey: ['patient-devices', id],
    queryFn: () => patientsAPI.getDevices(id!).then(r => r.data),
    enabled: !!id && (activeTab === 'appareils' || activeTab === 'informations' || activeTab === 'synthese'),
  })

  const { data: reports } = useQuery({
    queryKey: ['patient-reports', id],
    queryFn: () => reportsAPI.getPatientReports(id!).then(r => r.data),
    enabled: !!id && (activeTab === 'comptes_rendus' || activeTab === 'synthese'),
  })

  const { data: fittingSessions } = useQuery({
    queryKey: ['patient-fitting', id],
    queryFn: () => fittingAPI.getPatientSessions(id!).then(r => r.data),
    enabled: !!id && activeTab === 'reglage',
  })

  const { data: allAppointments } = useQuery({
    queryKey: ['appointments-patient', id],
    queryFn: () => appointmentsAPI.list().then(r => r.data),
    enabled: !!id && activeTab === 'synthese',
  })

  const { data: patientDevis } = useQuery({
    queryKey: ['patient-devis', id],
    queryFn: () => billingAPI.listDevis({ patient_id: id }).then(r => r.data),
    enabled: !!id && (activeTab === 'facturation' || activeTab === 'synthese'),
  })

  const { data: patientFactures } = useQuery({
    queryKey: ['patient-factures', id],
    queryFn: () => billingAPI.listFactures({ patient_id: id }).then(r => r.data),
    enabled: !!id && activeTab === 'facturation',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Chargement du dossier…</p>
        </div>
      </div>
    )
  }
  if (!patient) {
    return (
      <div className="text-center py-24">
        <p className="text-red-500 font-medium">Patient introuvable</p>
        <button className="btn-secondary mt-4" onClick={() => navigate('/patients')}>
          <ArrowLeft className="w-4 h-4" /> Retour aux patients
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-0 -m-6">
      {/* ── Bandeau supérieur ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 pt-5 pb-0">
        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between mb-4">
          <button
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            onClick={() => navigate('/patients')}
          >
            <ArrowLeft className="w-4 h-4" />
            Patients
          </button>
          <button className="btn-secondary text-sm py-1.5">
            <Edit3 className="w-3.5 h-3.5" />
            Modifier
          </button>
        </div>

        {/* Identité */}
        <div className="flex items-start gap-5 pb-4">
          {/* Avatar initial */}
          <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-700 font-bold text-xl">
            {patient.last_name?.[0]?.toUpperCase()}{patient.first_name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {patient.last_name.toUpperCase()} {patient.first_name}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-500">
              <span>
                Né(e) le {format(new Date(patient.birth_date), 'dd MMMM yyyy', { locale: fr })}
              </span>
              {patient.gender && (
                <span className="badge bg-gray-100 text-gray-600">
                  {patient.gender === 'M' ? 'Homme' : 'Femme'}
                </span>
              )}
              {patient.lateralite && (
                <span className="badge bg-brand-100 text-brand-700">
                  Appareillage {patient.lateralite}
                </span>
              )}
              {patient.type_appareillage && (
                <span className="badge bg-indigo-100 text-indigo-700">
                  {patient.type_appareillage}
                </span>
              )}
              {patient.mutuelle && (
                <span className="badge bg-green-100 text-green-700">
                  {patient.mutuelle}
                </span>
              )}
            </div>
            {/* Contacts rapides */}
            <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-gray-500">
              {(patient.mobile || patient.phone) && (
                <a
                  href={`tel:${patient.mobile || patient.phone}`}
                  className="flex items-center gap-1 hover:text-brand-600"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {patient.mobile || patient.phone}
                </a>
              )}
              {patient.email && (
                <a
                  href={`mailto:${patient.email}`}
                  className="flex items-center gap-1 hover:text-brand-600"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {patient.email}
                </a>
              )}
              {patient.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {patient.postal_code} {patient.city}
                </span>
              )}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              className="btn-primary text-sm py-2"
              onClick={() => navigate(`/fitting?patient=${patient.id}`)}
            >
              <Sliders className="w-3.5 h-3.5" />
              Réglage IA
            </button>
            <button
              className="btn-secondary text-sm py-2"
              onClick={() => { setActiveTab('pec') }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              PEC
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tabId
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu des onglets ────────────────────────────────────────── */}
      <div className="p-6">

        {/* ── Synthèse ── */}
        {activeTab === 'synthese' && (() => {
          const now = new Date()
          const lastAudio = audiograms?.[0]
          const activeDevices = (devices ?? []).filter((d: any) => d.statut === 'adapte' || d.statut === 'en_essai')
          const patientAppts = (allAppointments ?? []).filter((a: any) => a.patient_id === id)
          const lastAppt = patientAppts.sort((a: any, b: any) => parseISO(b.debut).getTime() - parseISO(a.debut).getTime())[0]
          const nextAppts = patientAppts.filter((a: any) => parseISO(a.debut) > now).sort((a: any, b: any) => parseISO(a.debut).getTime() - parseISO(b.debut).getTime()).slice(0, 2)
          const monthsSinceLastAppt = lastAppt ? differenceInMonths(now, parseISO(lastAppt.debut)) : null
          const monthsSinceLastAudio = lastAudio ? differenceInMonths(now, parseISO(lastAudio.date_mesure)) : null
          const pendingDevis = (patientDevis ?? []).filter((d: any) => d.statut === 'brouillon' || d.statut === 'envoye')

          let score = 0
          if (lastAudio && monthsSinceLastAudio !== null && monthsSinceLastAudio < 12) score += 30
          if (activeDevices.length > 0) score += 30
          if (lastAppt && monthsSinceLastAppt !== null && monthsSinceLastAppt < 12) score += 20
          if (patient.notes) score += 10
          if (patient.nir) score += 10

          const scoreColor = score >= 70 ? 'text-green-600 bg-green-50 border-green-200' : score >= 40 ? 'text-orange-500 bg-orange-50 border-orange-200' : 'text-red-500 bg-red-50 border-red-200'
          const scoreIcon = score >= 70 ? CheckCircle2 : score >= 40 ? Clock : AlertTriangle
          const ScoreIcon = scoreIcon

          return (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 flex items-center gap-4 ${scoreColor}`}>
                <ScoreIcon className="w-8 h-8 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-2xl">{score}/100</span>
                    <span className="font-semibold text-sm">Score de suivi</span>
                  </div>
                  <p className="text-xs mt-0.5 opacity-80">
                    {score >= 70 ? 'Dossier bien suivi — continuez ainsi !' : score >= 40 ? 'Suivi partiel — quelques actions recommandées.' : 'Attention — ce patient nécessite une attention particulière.'}
                  </p>
                </div>
                <div className="text-right text-xs opacity-70 space-y-0.5">
                  {lastAudio && monthsSinceLastAudio !== null && monthsSinceLastAudio < 12 && <div>✓ Audiogramme récent</div>}
                  {activeDevices.length > 0 && <div>✓ Appareils actifs</div>}
                  {lastAppt && monthsSinceLastAppt !== null && monthsSinceLastAppt < 12 && <div>✓ RDV récent</div>}
                  {patient.nir && <div>✓ NIR renseigné</div>}
                </div>
              </div>

              {monthsSinceLastAppt !== null && monthsSinceLastAppt > 6 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center gap-3 text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Pas de rendez-vous depuis {monthsSinceLastAppt} mois — pensez à recontacter ce patient.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="card p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Dernier audiogramme</h3>
                  {lastAudio ? (
                    <div className="space-y-1.5 text-sm">
                      <p className="text-xs text-gray-400">{format(parseISO(lastAudio.date_mesure), 'dd MMMM yyyy', { locale: fr })} {monthsSinceLastAudio !== null && monthsSinceLastAudio > 11 && <span className="text-orange-500 ml-1">({monthsSinceLastAudio} mois)</span>}</p>
                      {lastAudio.perte_moyenne_od != null && (
                        <div className="flex items-center gap-2">
                          <span className="badge bg-blue-100 text-blue-700 text-xs">OD</span>
                          <span className="font-medium">{lastAudio.perte_moyenne_od} dB</span>
                          {lastAudio.classification_od && <span className="text-gray-500 text-xs">— {lastAudio.classification_od}</span>}
                        </div>
                      )}
                      {lastAudio.perte_moyenne_og != null && (
                        <div className="flex items-center gap-2">
                          <span className="badge bg-pink-100 text-pink-700 text-xs">OG</span>
                          <span className="font-medium">{lastAudio.perte_moyenne_og} dB</span>
                          {lastAudio.classification_og && <span className="text-gray-500 text-xs">— {lastAudio.classification_og}</span>}
                        </div>
                      )}
                    </div>
                  ) : <p className="text-sm text-gray-400">Aucun audiogramme</p>}
                </div>

                <div className="card p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Appareils actifs</h3>
                  {activeDevices.length > 0 ? (
                    <div className="space-y-2">
                      {activeDevices.map((d: any) => (
                        <div key={d.id} className="flex items-center gap-2 text-sm">
                          <span className={`badge text-xs ${d.cote === 'droit' ? 'bg-blue-100 text-blue-700' : d.cote === 'gauche' ? 'bg-pink-100 text-pink-700' : 'bg-purple-100 text-purple-700'}`}>
                            {d.cote === 'droit' ? 'OD' : d.cote === 'gauche' ? 'OG' : 'Bilat.'}
                          </span>
                          <span className="font-medium truncate">{d.catalog ? `${d.catalog.marque} ${d.catalog.modele}` : 'Non catalogué'}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-400">Aucun appareil actif</p>}
                </div>

                <div className="card p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Prochains RDV</h3>
                  {nextAppts.length > 0 ? (
                    <div className="space-y-2">
                      {nextAppts.map((a: any) => (
                        <div key={a.id} className="text-sm">
                          <p className="font-medium">{format(parseISO(a.debut), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
                          <p className="text-xs text-gray-400">{a.type} — dans {differenceInDays(parseISO(a.debut), now)} j</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-400">Aucun RDV planifié</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Derniers comptes rendus</h3>
                  {reports && (reports as any[]).length > 0 ? (
                    <div className="space-y-2">
                      {(reports as any[]).slice(0, 2).map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium">{r.titre}</p>
                            <p className="text-xs text-gray-400">{format(parseISO(r.date_redaction), 'dd/MM/yyyy')}</p>
                          </div>
                          <a href={`/api/v1/reports/${r.id}/pdf`} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-blue-50 text-blue-600">
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-400">Aucun compte rendu</p>}
                </div>

                <div className="card p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Devis en cours</h3>
                  {pendingDevis.length > 0 ? (
                    <div className="space-y-2">
                      {pendingDevis.slice(0, 3).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium">{d.numero}</p>
                            <p className="text-xs text-gray-400">{d.montant_ttc?.toFixed(2)} € TTC</p>
                          </div>
                          <span className={`badge text-xs ${d.statut === 'envoye' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{d.statut}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-gray-400">Aucun devis en attente</p>}
                  <button className="mt-3 w-full text-xs text-brand-600 hover:text-brand-700 font-medium" onClick={() => setActiveTab('facturation')}>
                    Voir toute la facturation →
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Informations ── */}
        {activeTab === 'informations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Identité complète */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wide text-gray-500">
                Coordonnées
              </h3>
              <dl className="space-y-2.5 text-sm">
                {([
                  ['NIR', patient.nir],
                  ['Adresse', patient.address],
                  ['Ville', patient.city ? `${patient.postal_code || ''} ${patient.city}`.trim() : null],
                  ['Téléphone', patient.phone],
                  ['Mobile', patient.mobile],
                  ['Email', patient.email],
                ] as [string, string | undefined | null][]).map(([label, val]) => val ? (
                  <div key={label} className="flex gap-3">
                    <dt className="text-gray-400 w-24 flex-shrink-0">{label}</dt>
                    <dd className="text-gray-900">{val}</dd>
                  </div>
                ) : null)}
              </dl>
            </div>

            {/* Audiologie */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-gray-500">
                Informations audiologiques
              </h3>
              <dl className="space-y-2.5 text-sm">
                {([
                  ['Latéralité', patient.lateralite ? { bilateral: 'Bilatéral', droit: 'Droit', gauche: 'Gauche' }[patient.lateralite] : null],
                  ['Type appareil', patient.type_appareillage],
                  ['Prescripteur', patient.prescripteur],
                ] as [string, string | undefined | null][]).map(([label, val]) => val ? (
                  <div key={label} className="flex gap-3">
                    <dt className="text-gray-400 w-28 flex-shrink-0">{label}</dt>
                    <dd className="text-gray-900 font-medium">{val}</dd>
                  </div>
                ) : null)}
              </dl>
            </div>

            {/* Mutuelle */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-gray-500">
                Couverture sociale
              </h3>
              <dl className="space-y-2.5 text-sm">
                {([
                  ['Mutuelle', patient.mutuelle],
                  ['N° adhérent', patient.numero_adherent_mutuelle],
                ] as [string, string | undefined | null][]).map(([label, val]) => val ? (
                  <div key={label} className="flex gap-3">
                    <dt className="text-gray-400 w-28 flex-shrink-0">{label}</dt>
                    <dd className="text-gray-900 font-medium">{val}</dd>
                  </div>
                ) : null)}
              </dl>
              {patient.mutuelle && (
                <button
                  className="mt-4 btn-primary text-xs py-2 w-full justify-center"
                  onClick={() => setActiveTab('pec')}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Gérer les prises en charge
                </button>
              )}
            </div>

            {/* Appareils actuels */}
            {devices && devices.length > 0 && (
              <div className="card p-5 lg:col-span-3">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-gray-500">
                  Appareils en cours
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {devices.map((d: any) => (
                    <div key={d.id} className="p-3 bg-gray-50 rounded-xl flex items-start gap-3">
                      <span className={`badge mt-0.5 flex-shrink-0 ${
                        d.cote === 'droit' ? 'bg-blue-100 text-blue-700' :
                        d.cote === 'gauche' ? 'bg-pink-100 text-pink-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {d.cote === 'droit' ? 'OD' : d.cote === 'gauche' ? 'OG' : 'Bilat.'}
                      </span>
                      <div className="min-w-0">
                        {d.catalog ? (
                          <>
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {d.catalog.marque} {d.catalog.modele}
                            </p>
                            <p className="text-xs text-gray-500">Réf. {d.catalog.reference}</p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">Appareil non catalogué</p>
                        )}
                        {d.numero_serie && (
                          <p className="text-xs text-gray-400 font-mono">S/N {d.numero_serie}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge text-xs ${
                            d.statut === 'adapte' ? 'bg-green-100 text-green-700' :
                            d.statut === 'en_essai' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{d.statut}</span>
                          {d.reste_a_charge !== null && d.reste_a_charge !== undefined && (
                            <span className="text-xs text-gray-500">RAC {d.reste_a_charge.toFixed(0)} €</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {patient.notes && (
              <div className="card p-5 lg:col-span-3">
                <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-gray-500">Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{patient.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Audiogrammes ── */}
        {activeTab === 'audiogrammes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Audiogrammes</h2>
              <button className="btn-primary text-sm">+ Saisir un audiogramme</button>
            </div>
            {audiograms && audiograms.length > 0 ? (
              audiograms.map((a: any) => (
                <div key={a.id} className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">
                        {format(new Date(a.date_mesure), 'dd MMMM yyyy', { locale: fr })}
                      </span>
                      <span className="badge bg-gray-100 text-gray-600 capitalize">{a.type}</span>
                    </div>
                    <div className="flex gap-2">
                      {a.perte_moyenne_od !== null && a.perte_moyenne_od !== undefined && (
                        <span className="badge bg-blue-100 text-blue-800 text-xs">
                          OD {a.perte_moyenne_od} dB — {a.classification_od}
                        </span>
                      )}
                      {a.perte_moyenne_og !== null && a.perte_moyenne_og !== undefined && (
                        <span className="badge bg-pink-100 text-pink-800 text-xs">
                          OG {a.perte_moyenne_og} dB — {a.classification_og}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <AudiogramTable seuils={a.seuils_od_ca} label="Oreille droite — Conduction aérienne (dB HL)" />
                      {a.seuils_od_co && Object.keys(a.seuils_od_co).length > 0 && (
                        <AudiogramTable seuils={a.seuils_od_co} label="Oreille droite — Conduction osseuse" />
                      )}
                    </div>
                    <div className="space-y-3">
                      <AudiogramTable seuils={a.seuils_og_ca} label="Oreille gauche — Conduction aérienne (dB HL)" />
                      {a.seuils_og_co && Object.keys(a.seuils_og_co).length > 0 && (
                        <AudiogramTable seuils={a.seuils_og_co} label="Oreille gauche — Conduction osseuse" />
                      )}
                    </div>
                  </div>

                  {(a.vocal_od_intelligibilite !== null || a.vocal_og_intelligibilite !== null) && (
                    <div className="mt-4 flex gap-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
                      {a.vocal_od_intelligibilite !== null && a.vocal_od_intelligibilite !== undefined && (
                        <span>Vocal OD : <strong>{a.vocal_od_intelligibilite}%</strong></span>
                      )}
                      {a.vocal_og_intelligibilite !== null && a.vocal_og_intelligibilite !== undefined && (
                        <span>Vocal OG : <strong>{a.vocal_og_intelligibilite}%</strong></span>
                      )}
                      {a.tymp_od && <span>Tympan OD : <strong>{a.tymp_od}</strong></span>}
                      {a.tymp_og && <span>Tympan OG : <strong>{a.tymp_og}</strong></span>}
                    </div>
                  )}

                  {a.commentaire && (
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{a.commentaire}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="card p-12 text-center text-gray-400">
                <Ear className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                Aucun audiogramme enregistré
              </div>
            )}
          </div>
        )}

        {/* ── Appareils ── */}
        {activeTab === 'appareils' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Appareils auditifs</h2>
              <button className="btn-primary text-sm">+ Ajouter un appareil</button>
            </div>
            {devices && devices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {devices.map((d: any) => (
                  <div key={d.id} className="card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`badge ${
                        d.cote === 'droit' ? 'bg-blue-100 text-blue-700' :
                        d.cote === 'gauche' ? 'bg-pink-100 text-pink-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {d.cote === 'droit' ? 'Oreille droite' : d.cote === 'gauche' ? 'Oreille gauche' : 'Bilatéral'}
                      </span>
                      <span className={`badge ${
                        d.statut === 'adapte' ? 'bg-green-100 text-green-700' :
                        d.statut === 'en_essai' ? 'bg-yellow-100 text-yellow-700' :
                        d.statut === 'en_sav' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{d.statut.replace('_', ' ')}</span>
                    </div>
                    {d.catalog ? (
                      <>
                        <h3 className="font-bold text-gray-900">{d.catalog.marque} {d.catalog.modele}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Réf. {d.catalog.reference}</p>
                        {d.catalog.type_appareil && (
                          <span className="badge bg-gray-100 text-gray-600 mt-2">{d.catalog.type_appareil}</span>
                        )}
                      </>
                    ) : (
                      <h3 className="font-medium text-gray-600">Appareil non catalogué</h3>
                    )}
                    {d.numero_serie && (
                      <p className="text-xs text-gray-400 font-mono mt-2">N° série : {d.numero_serie}</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
                      {d.prix_vente_ht && (
                        <div>
                          <p className="text-xs text-gray-400">Prix vente HT</p>
                          <p className="font-medium">{d.prix_vente_ht.toFixed(2)} €</p>
                        </div>
                      )}
                      {d.reste_a_charge !== null && d.reste_a_charge !== undefined && (
                        <div>
                          <p className="text-xs text-gray-400">Reste à charge</p>
                          <p className="font-bold text-brand-700">{d.reste_a_charge.toFixed(2)} €</p>
                        </div>
                      )}
                      {d.remboursement_secu && (
                        <div>
                          <p className="text-xs text-gray-400">Remb. Sécu</p>
                          <p className="font-medium text-green-700">{d.remboursement_secu.toFixed(2)} €</p>
                        </div>
                      )}
                      {d.remboursement_mutuelle && (
                        <div>
                          <p className="text-xs text-gray-400">Remb. Mutuelle</p>
                          <p className="font-medium text-green-700">{d.remboursement_mutuelle.toFixed(2)} €</p>
                        </div>
                      )}
                    </div>
                    {d.date_fin_garantie && (
                      <p className="text-xs text-gray-400 mt-2">
                        Garantie jusqu'au {format(new Date(d.date_fin_garantie), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-400">
                <Ear className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                Aucun appareil enregistré
              </div>
            )}
          </div>
        )}

        {/* ── Prises en charge ── */}
        {activeTab === 'pec' && (
          <PECPanel patient={patient} />
        )}

        {/* ── Comptes rendus ── */}
        {activeTab === 'comptes_rendus' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Comptes rendus</h2>
              <button
                className="btn-primary text-sm"
                onClick={() => navigate(`/reports?patient=${patient.id}`)}
              >
                <FileText className="w-4 h-4" />
                Générer un CR
              </button>
            </div>
            {reports && (reports as any[]).length > 0 ? (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prescripteur</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(reports as any[]).map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/reports')}>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.titre}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{r.type.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-gray-500">{r.prescripteur_nom || '—'}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {format(new Date(r.date_redaction), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${
                            r.statut === 'finalise' ? 'bg-green-100 text-green-700' :
                            r.statut === 'envoye' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{r.statut}</span>
                        </td>
                        <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-400" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                Aucun compte rendu
              </div>
            )}
          </div>
        )}

        {/* ── Facturation ── */}
        {activeTab === 'facturation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Facturation</h2>
              <button className="btn-primary text-sm" onClick={() => navigate(`/billing?patient_id=${patient.id}`)}>
                <Receipt className="w-4 h-4" />
                Nouveau devis
              </button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Devis</h3>
              {patientDevis && (patientDevis as any[]).length > 0 ? (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N°</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant TTC</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                        <th className="px-4 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(patientDevis as any[]).map((d: any) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{d.numero}</td>
                          <td className="px-4 py-3 text-gray-500">{format(parseISO(d.date_devis), 'dd/MM/yyyy')}</td>
                          <td className="px-4 py-3 font-semibold">{d.montant_ttc?.toFixed(2)} €</td>
                          <td className="px-4 py-3">
                            <span className={`badge text-xs ${
                              d.statut === 'accepte' ? 'bg-green-100 text-green-700' :
                              d.statut === 'envoye' ? 'bg-blue-100 text-blue-700' :
                              d.statut === 'refuse' ? 'bg-red-100 text-red-700' :
                              d.statut === 'expire' ? 'bg-gray-100 text-gray-500' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>{d.statut}</span>
                          </td>
                          <td className="px-4 py-3">
                            <a href={billingAPI.getDevisPdfUrl(d.id)} target="_blank" rel="noreferrer"
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600 inline-flex">
                              <Download className="w-4 h-4" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card p-8 text-center text-gray-400 text-sm">Aucun devis pour ce patient</div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Factures</h3>
              {patientFactures && (patientFactures as any[]).length > 0 ? (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N°</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TTC</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payé</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reste</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                        <th className="px-4 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(patientFactures as any[]).map((f: any) => (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{f.numero}</td>
                          <td className="px-4 py-3 text-gray-500">{format(parseISO(f.date_facture), 'dd/MM/yyyy')}</td>
                          <td className="px-4 py-3 font-semibold">{f.montant_ttc?.toFixed(2)} €</td>
                          <td className="px-4 py-3 text-green-700">{f.montant_paye?.toFixed(2)} €</td>
                          <td className={`px-4 py-3 font-semibold ${f.reste_a_payer > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {f.reste_a_payer?.toFixed(2)} €
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge text-xs ${
                              f.statut === 'payee' ? 'bg-green-100 text-green-700' :
                              f.statut === 'partiellement_payee' ? 'bg-orange-100 text-orange-700' :
                              f.statut === 'annulee' ? 'bg-gray-100 text-gray-500' :
                              'bg-blue-100 text-blue-700'
                            }`}>{f.statut}</span>
                          </td>
                          <td className="px-4 py-3">
                            <a href={billingAPI.getFacturePdfUrl(f.id)} target="_blank" rel="noreferrer"
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-600 inline-flex">
                              <Download className="w-4 h-4" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card p-8 text-center text-gray-400 text-sm">Aucune facture pour ce patient</div>
              )}
            </div>
          </div>
        )}

        {/* ── Cosium ── */}
        {activeTab === 'cosium' && (
          <CosiumPanel patient={patient} />
        )}

        {/* ── Réglage IA ── */}
        {activeTab === 'reglage' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Historique des sessions de réglage</h2>
              <button
                className="btn-primary text-sm"
                onClick={() => navigate(`/fitting?patient=${patient.id}`)}
              >
                <Sliders className="w-4 h-4" />
                Démarrer une session
              </button>
            </div>
            {fittingSessions && (fittingSessions as any[]).length > 0 ? (
              <div className="space-y-3">
                {(fittingSessions as any[]).map((s: any) => (
                  <div key={s.id} className="card p-4 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        Session du {format(new Date(s.date_session), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                      {s.situations_testees && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {(s.situations_testees as any[]).length} situation(s) testée(s)
                        </p>
                      )}
                      {s.notes && <p className="text-sm text-gray-600 mt-1 italic">{s.notes}</p>}
                    </div>
                    {s.satisfaction_patient !== null && s.satisfaction_patient !== undefined && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Satisfaction</p>
                        <p className={`text-lg font-bold ${
                          s.satisfaction_patient >= 8 ? 'text-green-600' :
                          s.satisfaction_patient >= 5 ? 'text-yellow-600' :
                          'text-red-500'
                        }`}>{s.satisfaction_patient}/10</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-12 text-center text-gray-400">
                <Sliders className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                Aucune session de réglage enregistrée
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
