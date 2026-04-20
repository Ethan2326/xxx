import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersAPI, patientsAPI, catalogAPI } from '@/services/api'
import { ShoppingCart, Plus, Send, Eye, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Order, Patient } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  envoyee: 'bg-blue-100 text-blue-700',
  confirmee: 'bg-indigo-100 text-indigo-700',
  en_preparation: 'bg-yellow-100 text-yellow-700',
  expediee: 'bg-orange-100 text-orange-700',
  livree: 'bg-green-100 text-green-700',
  annulee: 'bg-red-100 text-red-700',
  retour: 'bg-purple-100 text-purple-700',
}

const FABRICANTS = [
  'Phonak', 'Oticon', 'Signia', 'ReSound', 'Widex', 'Starkey', 'Bernafon', 'Unitron', 'Beltone', 'Interton'
]

export default function OrdersPage() {
  const [showForm, setShowForm] = useState(false)
  const [ediPreview, setEdiPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    fabricant: 'Phonak',
    type: 'neuf',
    patient_id: '',
    notes: '',
    items: [{ reference: '', designation: '', quantite: 1, prix_unitaire_ht: 0 }],
  })

  const queryClient = useQueryClient()

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersAPI.list().then(r => r.data),
  })

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsAPI.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => ordersAPI.create(form as Parameters<typeof ordersAPI.create>[0]).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setShowForm(false)
    },
  })

  const sendEdiMutation = useMutation({
    mutationFn: (id: string) => ordersAPI.sendEdi(id).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  const addItem = () => setForm({
    ...form,
    items: [...form.items, { reference: '', designation: '', quantite: 1, prix_unitaire_ht: 0 }],
  })

  const updateItem = (idx: number, field: string, value: unknown) => {
    const items = [...form.items]
    items[idx] = { ...items[idx], [field]: value }
    setForm({ ...form, items })
  }

  const handlePreviewEdi = async (id: string) => {
    const { data } = await ordersAPI.previewEdi(id)
    setEdiPreview(data.edi_message)
  }

  const total = form.items.reduce((s, i) => s + (i.prix_unitaire_ht * i.quantite), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes EDI</h1>
          <p className="text-gray-500 mt-1">Commandes électroniques aux fabricants (EDIFACT ORDERS D.96A)</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" />
          Nouvelle commande
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Créer une commande</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Fabricant *</label>
              <select className="input" value={form.fabricant} onChange={e => setForm({ ...form, fabricant: e.target.value })}>
                {FABRICANTS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="neuf">Neuf</option>
                <option value="sav">SAV</option>
                <option value="retour">Retour</option>
                <option value="consommable">Consommable</option>
              </select>
            </div>
            <div>
              <label className="label">Patient (optionnel)</label>
              <select className="input" value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">— Sans patient —</option>
                {patients?.map((p: Patient) => (
                  <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lignes de commande */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Lignes de commande</label>
              <button className="btn-secondary py-1 px-3 text-xs" onClick={addItem}>+ Ajouter une ligne</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Référence</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Désignation</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-20">Qté</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">P.U. HT (€)</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">
                        <input className="input text-xs py-1" value={item.reference} onChange={e => updateItem(idx, 'reference', e.target.value)} placeholder="REF-001" />
                      </td>
                      <td className="px-2 py-1">
                        <input className="input text-xs py-1" value={item.designation} onChange={e => updateItem(idx, 'designation', e.target.value)} placeholder="Appareil auditif RITE" />
                      </td>
                      <td className="px-2 py-1">
                        <input className="input text-xs py-1" type="number" min="1" value={item.quantite} onChange={e => updateItem(idx, 'quantite', parseInt(e.target.value) || 1)} />
                      </td>
                      <td className="px-2 py-1">
                        <input className="input text-xs py-1" type="number" min="0" step="0.01" value={item.prix_unitaire_ht} onChange={e => updateItem(idx, 'prix_unitaire_ht', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700 font-medium">
                        {(item.prix_unitaire_ht * item.quantite).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold">Total HT :</td>
                    <td className="px-3 py-2 text-right font-bold text-brand-700">{total.toFixed(2)} €</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-3 py-1 text-right text-xs text-gray-500">TVA 5,5% :</td>
                    <td className="px-3 py-1 text-right text-xs text-gray-500">{(total * 0.055).toFixed(2)} €</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-3 py-1 text-right text-sm font-bold">Total TTC :</td>
                    <td className="px-3 py-1 text-right font-bold">{(total * 1.055).toFixed(2)} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Création…</> : 'Créer la commande'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste des commandes */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Commande</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabricant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant TTC</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders?.map((o: Order) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.numero_commande}</td>
                <td className="px-4 py-3 font-medium">{o.fabricant}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{o.type}</td>
                <td className="px-4 py-3 font-medium">{o.montant_ttc.toFixed(2)} €</td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_COLORS[o.statut]}`}>{o.statut}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{format(new Date(o.created_at), 'dd/MM/yyyy')}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      title="Aperçu EDI"
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      onClick={() => handlePreviewEdi(o.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {o.statut === 'brouillon' && (
                      <button
                        title="Envoyer EDI"
                        className="p-1.5 rounded hover:bg-brand-100 text-brand-600"
                        onClick={() => sendEdiMutation.mutate(o.id)}
                        disabled={sendEdiMutation.isPending}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!orders?.length && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Aucune commande</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal EDI preview */}
      {ediPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setEdiPreview(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold">Message EDIFACT ORDERS</h2>
              <button className="btn-secondary" onClick={() => setEdiPreview(null)}>Fermer</button>
            </div>
            <pre className="p-6 text-xs font-mono text-gray-700 whitespace-pre-wrap bg-gray-50">{ediPreview}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
