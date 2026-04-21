import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Loader2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import api from '@/services/api'
import type { Patient } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CosiumAppareil {
  date?: string
  type?: string
  marque?: string
  modele?: string
  reference?: string
  oreille?: string
  statut?: string
  montant?: number
  [key: string]: unknown
}

interface CosiumDevis {
  numero?: string
  date?: string
  designation?: string
  montant_ttc?: number
  statut?: string
  [key: string]: unknown
}

interface CosiumRdv {
  date?: string
  heure?: string
  date_heure?: string
  type?: string
  praticien?: string
  statut?: string
  [key: string]: unknown
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
    </div>
  )
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
      <AlertTriangle className="w-8 h-8 text-orange-300" />
      <p className="text-sm">Cosium non configuré ou inaccessible</p>
    </div>
  )
}

function devisStatutBadge(statut?: string) {
  const s = (statut || '').toLowerCase()
  if (s.includes('accept')) return 'bg-green-100 text-green-700'
  if (s.includes('refus')) return 'bg-red-100 text-red-700'
  if (s.includes('expir')) return 'bg-orange-100 text-orange-700'
  return 'bg-blue-100 text-blue-700' // en_attente / default
}

function formatDateSafe(val?: string) {
  if (!val) return '—'
  try {
    return format(new Date(val), 'dd/MM/yyyy', { locale: fr })
  } catch {
    return val
  }
}

function formatDateTimeSafe(val?: string) {
  if (!val) return '—'
  try {
    return format(new Date(val), 'dd/MM/yyyy HH:mm', { locale: fr })
  } catch {
    return val
  }
}

// ── Onglet Appareils ──────────────────────────────────────────────────────────
function AppareilsTab({ cosiumId }: { cosiumId: string }) {
  const { data, isLoading, isError } = useQuery<CosiumAppareil[]>({
    queryKey: ['cosium-appareils', cosiumId],
    queryFn: () =>
      api.get<CosiumAppareil[]>(`/integrations/cosium/patients/${cosiumId}/appareils`)
        .then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) return <Spinner />
  if (isError) return <ErrorState />
  if (!data || data.length === 0) {
    return <p className="text-center py-12 text-gray-400 text-sm">Aucun appareil dans Cosium</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marque / Modèle</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oreille</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((a, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">{formatDateSafe(a.date)}</td>
              <td className="px-4 py-3 text-gray-700">{a.type || '—'}</td>
              <td className="px-4 py-3 font-medium text-gray-900">
                {[a.marque, a.modele].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.reference || '—'}</td>
              <td className="px-4 py-3 text-gray-500">{a.oreille || '—'}</td>
              <td className="px-4 py-3">
                {a.statut
                  ? <span className="badge bg-gray-100 text-gray-600">{a.statut}</span>
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right text-gray-700">
                {a.montant != null ? `${a.montant.toFixed(2)} €` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Onglet Devis ──────────────────────────────────────────────────────────────
function DevisTab({ cosiumId }: { cosiumId: string }) {
  const { data, isLoading, isError } = useQuery<CosiumDevis[]>({
    queryKey: ['cosium-devis', cosiumId],
    queryFn: () =>
      api.get<CosiumDevis[]>(`/integrations/cosium/patients/${cosiumId}/devis`)
        .then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) return <Spinner />
  if (isError) return <ErrorState />
  if (!data || data.length === 0) {
    return <p className="text-center py-12 text-gray-400 text-sm">Aucun devis dans Cosium</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° devis</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Désignation</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant TTC</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((d, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.numero || '—'}</td>
              <td className="px-4 py-3 text-gray-500">{formatDateSafe(d.date)}</td>
              <td className="px-4 py-3 text-gray-900">{d.designation || '—'}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {d.montant_ttc != null ? `${d.montant_ttc.toFixed(2)} €` : '—'}
              </td>
              <td className="px-4 py-3">
                {d.statut
                  ? <span className={`badge ${devisStatutBadge(d.statut)}`}>{d.statut}</span>
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Onglet RDV ────────────────────────────────────────────────────────────────
function RdvTab({ cosiumId }: { cosiumId: string }) {
  const { data, isLoading, isError } = useQuery<CosiumRdv[]>({
    queryKey: ['cosium-rdv', cosiumId],
    queryFn: () =>
      api.get<CosiumRdv[]>(`/integrations/cosium/patients/${cosiumId}/rdv`)
        .then(r => r.data),
    staleTime: 60_000,
  })

  if (isLoading) return <Spinner />
  if (isError) return <ErrorState />
  if (!data || data.length === 0) {
    return <p className="text-center py-12 text-gray-400 text-sm">Aucun rendez-vous dans Cosium</p>
  }

  // Trier par date desc
  const sorted = [...data].sort((a, b) => {
    const da = a.date_heure || a.date || ''
    const db = b.date_heure || b.date || ''
    return db.localeCompare(da)
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date / Heure</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Praticien</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">
                {formatDateTimeSafe(r.date_heure || r.date)}
              </td>
              <td className="px-4 py-3 text-gray-700">{r.type || '—'}</td>
              <td className="px-4 py-3 text-gray-700">{r.praticien || '—'}</td>
              <td className="px-4 py-3">
                {r.statut
                  ? <span className="badge bg-gray-100 text-gray-600">{r.statut}</span>
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Panneau principal ─────────────────────────────────────────────────────────
type TabId = 'appareils' | 'devis' | 'rdv'

export default function CosiumPanel({ patient }: { patient: Patient }) {
  const queryClient = useQueryClient()
  const [cosiumInput, setCosiumInput] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('appareils')

  const linkMutation = useMutation({
    mutationFn: (cosiumId: string) =>
      api.post(`/integrations/cosium/patients/${patient.id}/link`, null, {
        params: { cosium_id: cosiumId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] })
    },
  })

  // ── Pas encore lié ────────────────────────────────────────────────────────
  if (!patient.cosium_id) {
    return (
      <div className="card p-6 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Link className="w-6 h-6 text-gray-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">Ce patient n'est pas encore lié à Cosium</p>
          <p className="text-sm text-gray-500 mt-1">
            Saisissez l'identifiant Cosium pour synchroniser les données.
          </p>
        </div>
        <div className="flex gap-2 w-full max-w-sm">
          <input
            className="input flex-1"
            placeholder="ID Cosium (ex: 12345)"
            value={cosiumInput}
            onChange={e => setCosiumInput(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={!cosiumInput.trim() || linkMutation.isPending}
            onClick={() => linkMutation.mutate(cosiumInput.trim())}
          >
            {linkMutation.isPending ? 'Liaison…' : 'Lier'}
          </button>
        </div>
        {linkMutation.isError && (
          <p className="text-sm text-red-500">Erreur lors de la liaison.</p>
        )}
      </div>
    )
  }

  // ── Lié : afficher les 3 onglets ──────────────────────────────────────────
  const TABS: { id: TabId; label: string }[] = [
    { id: 'appareils', label: 'Appareils' },
    { id: 'devis', label: 'Devis' },
    { id: 'rdv', label: 'RDV' },
  ]

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-0 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-4 h-4 text-brand-500" />
          <span className="text-sm font-semibold text-gray-700">Cosium</span>
          <span className="badge bg-gray-100 text-gray-500 font-mono text-xs">
            ID {patient.cosium_id}
          </span>
        </div>
        {/* Onglets */}
        <div className="flex gap-0 -mb-px">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div>
        {activeTab === 'appareils' && <AppareilsTab cosiumId={patient.cosium_id} />}
        {activeTab === 'devis' && <DevisTab cosiumId={patient.cosium_id} />}
        {activeTab === 'rdv' && <RdvTab cosiumId={patient.cosium_id} />}
      </div>
    </div>
  )
}
