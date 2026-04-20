import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { patientsAPI, reportsAPI, fittingAPI } from '@/services/api'
import { ArrowLeft, User, Ear, FileText, Sliders, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const FREQUENCIES = ['250', '500', '1000', '2000', '3000', '4000', '6000', '8000']

function AudiogramTable({ seuils, label }: { seuils: Record<string, number> | undefined | null; label: string }) {
  if (!seuils) return <span className="text-gray-400">—</span>
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex gap-1 flex-wrap">
        {FREQUENCIES.map(f => (
          <div key={f} className="text-center">
            <div className="text-xs text-gray-400">{parseInt(f) >= 1000 ? `${parseInt(f) / 1000}k` : f}</div>
            <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              seuils[f] === undefined ? 'text-gray-300' :
              seuils[f] < 25 ? 'text-green-600' :
              seuils[f] < 40 ? 'text-yellow-600' :
              seuils[f] < 55 ? 'text-orange-600' :
              'text-red-600'
            }`}>
              {seuils[f] !== undefined ? seuils[f] : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsAPI.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: audiograms } = useQuery({
    queryKey: ['patient-audiograms', id],
    queryFn: () => patientsAPI.getAudiograms(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: devices } = useQuery({
    queryKey: ['patient-devices', id],
    queryFn: () => patientsAPI.getDevices(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: reports } = useQuery({
    queryKey: ['patient-reports', id],
    queryFn: () => reportsAPI.getPatientReports(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: fittingSessions } = useQuery({
    queryKey: ['patient-fitting', id],
    queryFn: () => fittingAPI.getPatientSessions(id!).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) return <div className="text-center py-12 text-gray-400">Chargement…</div>
  if (!patient) return <div className="text-center py-12 text-red-400">Patient introuvable</div>

  const latestAudiograms = audiograms?.slice(0, 3) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button className="btn-secondary py-2 px-3" onClick={() => navigate('/patients')}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {patient.last_name.toUpperCase()} {patient.first_name}
          </h1>
          <p className="text-gray-500">
            Né(e) le {format(new Date(patient.birth_date), 'dd MMMM yyyy', { locale: fr })}
            {patient.lateralite && ` — Appareillage ${patient.lateralite}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Infos patient */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600" /> Informations
          </h2>
          <dl className="space-y-2 text-sm">
            {[
              ['NIR', patient.nir],
              ['Téléphone', patient.mobile || patient.phone],
              ['Email', patient.email],
              ['Mutuelle', patient.mutuelle],
              ['N° adhérent', patient.numero_adherent_mutuelle],
              ['Prescripteur', patient.prescripteur],
            ].map(([label, val]) => val && (
              <div key={label} className="flex gap-2">
                <dt className="text-gray-500 w-28 flex-shrink-0">{label}</dt>
                <dd className="text-gray-900 font-medium">{val}</dd>
              </div>
            ))}
          </dl>
          {patient.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              {patient.notes}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary text-xs py-2" onClick={() => navigate(`/fitting?patient=${id}`)}>
              <Sliders className="w-3.5 h-3.5" /> Réglage
            </button>
            <button className="btn-secondary text-xs py-2" onClick={() => navigate(`/reports?patient=${id}`)}>
              <FileText className="w-3.5 h-3.5" /> CR
            </button>
          </div>
        </div>

        {/* Appareils */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Ear className="w-4 h-4 text-brand-600" /> Appareils auditifs
          </h2>
          {devices && devices.length > 0 ? (
            <ul className="space-y-3">
              {devices.map((d: any) => (
                <li key={d.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`badge ${d.cote === 'droit' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {d.cote === 'droit' ? 'OD' : d.cote === 'gauche' ? 'OG' : 'Bilat.'}
                    </span>
                    <span className={`badge ${
                      d.statut === 'adapte' ? 'bg-green-100 text-green-700' :
                      d.statut === 'en_essai' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{d.statut}</span>
                  </div>
                  {d.catalog ? (
                    <>
                      <div className="font-medium text-sm text-gray-900">{d.catalog.marque} {d.catalog.modele}</div>
                      <div className="text-xs text-gray-500">Réf : {d.catalog.reference}</div>
                    </>
                  ) : <div className="text-sm text-gray-500">Appareil sans référence catalogue</div>}
                  {d.numero_serie && <div className="text-xs text-gray-400 mt-1">N° {d.numero_serie}</div>}
                  {d.reste_a_charge !== null && d.reste_a_charge !== undefined && (
                    <div className="text-xs text-gray-500 mt-1">RAC : {d.reste_a_charge.toFixed(2)} €</div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">Aucun appareil</p>
          )}
        </div>

        {/* Sessions réglage */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-600" /> Sessions réglage
          </h2>
          {fittingSessions && (fittingSessions as any[]).length > 0 ? (
            <ul className="space-y-2">
              {(fittingSessions as any[]).slice(0, 5).map((s: any) => (
                <li key={s.id} className="p-2 bg-gray-50 rounded-lg text-sm">
                  <div className="text-gray-700 font-medium">
                    {format(new Date(s.date_session), 'dd/MM/yyyy HH:mm')}
                  </div>
                  {s.satisfaction_patient && (
                    <div className="text-xs text-gray-500">Satisfaction : {s.satisfaction_patient}/10</div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">Aucune session</p>
          )}
        </div>
      </div>

      {/* Audiogrammes */}
      {latestAudiograms.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Ear className="w-4 h-4 text-brand-600" /> Audiogrammes
          </h2>
          <div className="space-y-4">
            {latestAudiograms.map((a: any) => (
              <div key={a.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-800">
                    {format(new Date(a.date_mesure), 'dd MMMM yyyy', { locale: fr })}
                  </span>
                  <div className="flex gap-2 text-xs">
                    {a.classification_od && (
                      <span className="badge bg-blue-100 text-blue-700">OD : {a.perte_moyenne_od} dB — {a.classification_od}</span>
                    )}
                    {a.classification_og && (
                      <span className="badge bg-pink-100 text-pink-700">OG : {a.perte_moyenne_og} dB — {a.classification_og}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <AudiogramTable seuils={a.seuils_od_ca} label="OD — Conduction aérienne" />
                  <AudiogramTable seuils={a.seuils_og_ca} label="OG — Conduction aérienne" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comptes rendus */}
      {reports && (reports as any[]).length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" /> Comptes rendus
          </h2>
          <ul className="space-y-2">
            {(reports as any[]).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer" onClick={() => navigate(`/reports`)}>
                <div>
                  <div className="font-medium text-sm text-gray-900">{r.titre}</div>
                  <div className="text-xs text-gray-500">{format(new Date(r.date_redaction), 'dd/MM/yyyy')}</div>
                </div>
                <span className={`badge ${
                  r.statut === 'finalise' ? 'bg-green-100 text-green-700' :
                  r.statut === 'envoye' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{r.statut}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
