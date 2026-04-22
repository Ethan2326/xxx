import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingAPI, patientsAPI, type DevisCreatePayload } from '@/services/api'
import type { Devis, Facture, Patient } from '@/types'
import {
  FileText, Plus, Download, TrendingUp, Euro, Clock, CheckCircle,
  X, ChevronDown, ChevronUp, Receipt
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── LPP forfaits pour calcul auto ────────────────────────────────────────────
const LPP: Record<number, { od: number; og: number }> = {
  1: { od: 200, og: 200 },
  2: { od: 1700, og: 1700 },
}

// ── Couleurs statuts ──────────────────────────────────────────────────────────
const DEVIS_STATUT: Record<string, { label: string; cls: string }> = {
  brouillon:  { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-700' },
  envoye:     { label: 'Envoyé',     cls: 'bg-blue-100 text-blue-700' },
  accepte:    { label: 'Accepté',    cls: 'bg-green-100 text-green-700' },
  facture:    { label: 'Facturé',    cls: 'bg-purple-100 text-purple-700' },
  refuse:     { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
  expire:     { label: 'Expiré',     cls: 'bg-orange-100 text-orange-700' },
}

const FACTURE_STATUT: Record<string, { label: string; cls: string }> = {
  emise:               { label: 'Émise',             cls: 'bg-blue-100 text-blue-700' },
  partiellement_payee: { label: 'Part. payée',        cls: 'bg-orange-100 text-orange-700' },
  payee:               { label: 'Payée',              cls: 'bg-green-100 text-green-700' },
  annulee:             { label: 'Annulée',            cls: 'bg-red-100 text-red-700' },
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Modale création devis ─────────────────────────────────────────────────────
function NewDevisModal({ patients, onClose, onCreated }: {
  patients: Patient[]
  onClose: () => void
  onCreated: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState<DevisCreatePayload>({
    patient_id: '',
    date_devis: today,
    appareil_od_classe_lpp: undefined,
    appareil_od_prix_ht: undefined,
    appareil_og_classe_lpp: undefined,
    appareil_og_prix_ht: undefined,
    remboursement_secu: undefined,
    remboursement_mutuelle: undefined,
  })

  const createMutation = useMutation({
    mutationFn: () => billingAPI.createDevis(form).then(r => r.data),
    onSuccess: () => { onCreated(); onClose() },
  })

  const computeRemb = () => {
    let base = 0
    if (form.appareil_od_classe_lpp) base += LPP[form.appareil_od_classe_lpp]?.od || 0
    if (form.appareil_og_classe_lpp) base += LPP[form.appareil_og_classe_lpp]?.og || 0
    return base
  }

  const computeTTC = () => {
    const od = (form.appareil_od_prix_ht || 0) * 1.055
    const og = (form.appareil_og_prix_ht || 0) * 1.055
    return od + og
  }

  const base = computeRemb()
  const ttc = computeTTC()
  const remb_s = form.remboursement_secu ?? base
  const remb_m = form.remboursement_mutuelle ?? 0
  const rac = Math.max(0, ttc - remb_s - remb_m)

  const set = (k: keyof DevisCreatePayload, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Nouveau devis</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Patient + date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
              <select value={form.patient_id} onChange={e => set('patient_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sélectionner…</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.last_name.toUpperCase()} {p.first_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date du devis</label>
              <input type="date" value={form.date_devis} onChange={e => set('date_devis', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Appareil OD */}
          <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="font-semibold text-blue-900 text-sm">Oreille Droite (OD)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Marque" value={form.appareil_od_marque || ''} onChange={e => set('appareil_od_marque', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Modèle" value={form.appareil_od_modele || ''} onChange={e => set('appareil_od_modele', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Référence" value={form.appareil_od_reference || ''} onChange={e => set('appareil_od_reference', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.appareil_od_classe_lpp || ''} onChange={e => set('appareil_od_classe_lpp', e.target.value ? Number(e.target.value) : undefined)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Classe LPP</option>
                  <option value="1">Classe 1 (200 €)</option>
                  <option value="2">Classe 2 (1 700 €)</option>
                </select>
                <input type="number" placeholder="Prix HT (€)" value={form.appareil_od_prix_ht || ''} onChange={e => set('appareil_od_prix_ht', e.target.value ? Number(e.target.value) : undefined)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Appareil OG */}
          <div className="border border-pink-100 rounded-xl p-4 bg-pink-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-pink-600" />
              <span className="font-semibold text-pink-900 text-sm">Oreille Gauche (OG)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Marque" value={form.appareil_og_marque || ''} onChange={e => set('appareil_og_marque', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Modèle" value={form.appareil_og_modele || ''} onChange={e => set('appareil_og_modele', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Référence" value={form.appareil_og_reference || ''} onChange={e => set('appareil_og_reference', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.appareil_og_classe_lpp || ''} onChange={e => set('appareil_og_classe_lpp', e.target.value ? Number(e.target.value) : undefined)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Classe LPP</option>
                  <option value="1">Classe 1 (200 €)</option>
                  <option value="2">Classe 2 (1 700 €)</option>
                </select>
                <input type="number" placeholder="Prix HT (€)" value={form.appareil_og_prix_ht || ''} onChange={e => set('appareil_og_prix_ht', e.target.value ? Number(e.target.value) : undefined)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Remboursements */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-sm font-semibold text-green-800 mb-3">Remboursements</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Remb. Sécu (€) — Base LPP : {base.toFixed(2)} €</label>
                <input type="number" placeholder={base.toFixed(2)} value={form.remboursement_secu ?? ''} onChange={e => set('remboursement_secu', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Remb. Mutuelle (€)</label>
                <input type="number" placeholder="0.00" value={form.remboursement_mutuelle ?? ''} onChange={e => set('remboursement_mutuelle', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Recap financier */}
            {ttc > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Total TTC</span><span className="font-semibold">{ttc.toFixed(2)} €</span></div>
                <div className="flex justify-between text-green-700"><span>— Remb. Sécu</span><span>- {remb_s.toFixed(2)} €</span></div>
                <div className="flex justify-between text-green-700"><span>— Remb. Mutuelle</span><span>- {remb_m.toFixed(2)} €</span></div>
                <div className="flex justify-between font-bold text-red-700 border-t border-green-200 pt-1 mt-1">
                  <span>Reste à charge</span><span>{rac.toFixed(2)} €</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)}
              placeholder="Informations complémentaires…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.patient_id || createMutation.isPending}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? 'Création…' : 'Créer le devis'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modale facturation depuis devis ──────────────────────────────────────────
function FactureFromDevisModal({ devis, patients, onClose, onCreated }: {
  devis: Devis
  patients: Patient[]
  onClose: () => void
  onCreated: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [dateFacture, setDateFacture] = useState(today)
  const createMutation = useMutation({
    mutationFn: () => billingAPI.createFacture({
      patient_id: devis.patient_id,
      devis_id: devis.id,
      date_facture: dateFacture,
    }).then(r => r.data),
    onSuccess: () => { onCreated(); onClose() },
  })

  const patient = patients.find(p => p.id === devis.patient_id)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Créer la facture</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm">
            <div className="font-semibold text-gray-900">{patient ? `${patient.last_name.toUpperCase()} ${patient.first_name}` : '—'}</div>
            <div className="text-gray-500">Devis {devis.numero} — {(devis.montant_ttc || 0).toFixed(2)} € TTC</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de facturation</label>
            <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
            className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
            {createMutation.isPending ? 'Création…' : 'Facturer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ligne de devis (expandable) ───────────────────────────────────────────────
function DevisRow({ devis, onFacturer, onUpdateStatut }: {
  devis: Devis
  onFacturer: (d: Devis) => void
  onUpdateStatut: (id: string, statut: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const st = DEVIS_STATUT[devis.statut] || { label: devis.statut, cls: 'bg-gray-100 text-gray-700' }

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3 text-sm font-mono text-blue-700 font-semibold">{devis.numero}</td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{devis.patient_nom || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {format(new Date(devis.date_devis), 'dd MMM yyyy', { locale: fr })}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
        </td>
        <td className="px-4 py-3 text-sm text-right font-semibold">{(devis.montant_ttc || 0).toFixed(2)} €</td>
        <td className="px-4 py-3 text-sm text-right text-red-600 font-semibold">{(devis.reste_a_charge || 0).toFixed(2)} €</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
            <a href={billingAPI.getDevisPdfUrl(devis.id)} target="_blank" rel="noreferrer"
              className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600" title="Télécharger PDF">
              <Download className="w-4 h-4" />
            </a>
            {devis.statut === 'brouillon' && (
              <button onClick={() => onUpdateStatut(devis.id, 'envoye')}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Envoyer</button>
            )}
            {(devis.statut === 'envoye' || devis.statut === 'accepte') && (
              <button onClick={() => onFacturer(devis)}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Facturer</button>
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 pb-3">
            <div className="bg-gray-50 rounded-xl p-4 text-sm grid grid-cols-3 gap-4">
              {(devis.appareil_od_marque || devis.appareil_og_marque) && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Appareils</div>
                  {devis.appareil_od_marque && <div className="text-blue-700">OD : {devis.appareil_od_marque} {devis.appareil_od_modele} — Classe {devis.appareil_od_classe_lpp}</div>}
                  {devis.appareil_og_marque && <div className="text-pink-700">OG : {devis.appareil_og_marque} {devis.appareil_og_modele} — Classe {devis.appareil_og_classe_lpp}</div>}
                </div>
              )}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Financier</div>
                <div>HT : {(devis.montant_total_ht || 0).toFixed(2)} €</div>
                <div>TVA : {(devis.montant_tva || 0).toFixed(2)} €</div>
                <div className="font-bold">TTC : {(devis.montant_ttc || 0).toFixed(2)} €</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Remboursements</div>
                <div className="text-green-700">Sécu : - {(devis.remboursement_secu || 0).toFixed(2)} €</div>
                <div className="text-green-700">Mutuelle : - {(devis.remboursement_mutuelle || 0).toFixed(2)} €</div>
                <div className="font-bold text-red-700">RAC : {(devis.reste_a_charge || 0).toFixed(2)} €</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Ligne de facture ──────────────────────────────────────────────────────────
function FactureRow({ facture, onMarquerPaye }: {
  facture: Facture
  onMarquerPaye: (id: string) => void
}) {
  const st = FACTURE_STATUT[facture.statut] || { label: facture.statut, cls: 'bg-gray-100 text-gray-700' }
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-mono text-green-700 font-semibold">{facture.numero}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{facture.patient_nom || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {format(new Date(facture.date_facture), 'dd MMM yyyy', { locale: fr })}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </td>
      <td className="px-4 py-3 text-sm text-right font-semibold">{(facture.montant_ttc || 0).toFixed(2)} €</td>
      <td className="px-4 py-3 text-sm text-right text-green-600">{(facture.montant_paye || 0).toFixed(2)} €</td>
      <td className="px-4 py-3 text-sm text-right text-red-600 font-semibold">{(facture.reste_a_payer || 0).toFixed(2)} €</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <a href={billingAPI.getFacturePdfUrl(facture.id)} target="_blank" rel="noreferrer"
            className="p-1.5 hover:bg-green-100 rounded-lg text-green-600" title="Télécharger PDF">
            <Download className="w-4 h-4" />
          </a>
          {facture.statut !== 'payee' && facture.statut !== 'annulee' && (
            <button onClick={() => onMarquerPaye(facture.id)}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Soldée</button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function BillingPage() {
  const [tab, setTab] = useState<'devis' | 'factures'>('devis')
  const [showNewDevis, setShowNewDevis] = useState(false)
  const [devisToFacture, setDevisToFacture] = useState<Devis | null>(null)
  const qc = useQueryClient()

  const { data: stats } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => billingAPI.stats().then(r => r.data),
  })

  const { data: devisList = [], isLoading: loadingDevis } = useQuery({
    queryKey: ['devis'],
    queryFn: () => billingAPI.listDevis().then(r => r.data),
  })

  const { data: facturesList = [], isLoading: loadingFactures } = useQuery({
    queryKey: ['factures'],
    queryFn: () => billingAPI.listFactures().then(r => r.data),
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsAPI.list().then(r => r.data),
  })

  const updateDevisMutation = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: string }) =>
      billingAPI.updateDevis(id, { statut }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devis'] }),
  })

  const marquerPayeeMutation = useMutation({
    mutationFn: (id: string) =>
      billingAPI.updateFacture(id, { montant_paye: 999999, statut: 'payee' }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factures'] })
      qc.invalidateQueries({ queryKey: ['billing-stats'] })
    },
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['devis'] })
    qc.invalidateQueries({ queryKey: ['factures'] })
    qc.invalidateQueries({ queryKey: ['billing-stats'] })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis & Factures</h1>
          <p className="text-gray-500 text-sm">Gestion de la facturation — LPP Classes 1 & 2</p>
        </div>
        {tab === 'devis' && (
          <button onClick={() => setShowNewDevis(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nouveau devis
          </button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Devis en cours" value={String(stats.nb_devis)} sub={`${stats.total_devis_ttc.toFixed(0)} € total`} color="bg-blue-50 text-blue-900" />
          <StatCard label="Factures émises" value={String(stats.nb_factures)} sub={`${stats.total_factures_ttc.toFixed(0)} € total`} color="bg-green-50 text-green-900" />
          <StatCard label="Reste à encaisser" value={`${stats.reste_a_encaisser.toFixed(0)} €`} color={stats.reste_a_encaisser > 0 ? "bg-orange-50 text-orange-900" : "bg-gray-50 text-gray-700"} />
          <StatCard label="CA facturé" value={`${stats.total_factures_ttc.toFixed(0)} €`} color="bg-purple-50 text-purple-900" />
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 px-4">
          <button onClick={() => setTab('devis')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'devis' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            <div className="flex items-center gap-2"><FileText className="w-4 h-4" /> Devis ({devisList.length})</div>
          </button>
          <button onClick={() => setTab('factures')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'factures' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            <div className="flex items-center gap-2"><Receipt className="w-4 h-4" /> Factures ({facturesList.length})</div>
          </button>
        </div>

        {/* Table devis */}
        {tab === 'devis' && (
          <div className="overflow-x-auto">
            {loadingDevis ? (
              <div className="p-12 text-center text-gray-400">Chargement…</div>
            ) : devisList.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aucun devis pour l'instant</p>
                <button onClick={() => setShowNewDevis(true)} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">
                  Créer le premier devis
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N°</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">TTC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">RAC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {devisList.map(d => (
                    <DevisRow key={d.id} devis={d}
                      onFacturer={setDevisToFacture}
                      onUpdateStatut={(id, statut) => updateDevisMutation.mutate({ id, statut })} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Table factures */}
        {tab === 'factures' && (
          <div className="overflow-x-auto">
            {loadingFactures ? (
              <div className="p-12 text-center text-gray-400">Chargement…</div>
            ) : facturesList.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aucune facture pour l'instant</p>
                <p className="text-gray-400 text-sm mt-1">Les factures sont créées depuis les devis acceptés</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N°</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">TTC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Payé</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Reste</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {facturesList.map(f => (
                    <FactureRow key={f.id} facture={f}
                      onMarquerPaye={(id) => marquerPayeeMutation.mutate(id)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {showNewDevis && (
        <NewDevisModal patients={patients} onClose={() => setShowNewDevis(false)} onCreated={invalidateAll} />
      )}
      {devisToFacture && (
        <FactureFromDevisModal
          devis={devisToFacture}
          patients={patients}
          onClose={() => setDevisToFacture(null)}
          onCreated={invalidateAll} />
      )}
    </div>
  )
}
