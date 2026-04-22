import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsAPI, patientsAPI } from '@/services/api'
import { FileText, Plus, Loader2, Eye, Download } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Report, Patient } from '@/types'

const REPORT_TYPES = [
  { value: 'bilan_initial', label: 'Bilan initial' },
  { value: 'appareillage', label: 'Appareillage' },
  { value: 'controle_3mois', label: 'Contrôle 3 mois' },
  { value: 'controle_annuel', label: 'Contrôle annuel' },
  { value: 'fin_essai', label: 'Fin d\'essai' },
  { value: 'sav', label: 'SAV' },
  { value: 'renouvellement', label: 'Renouvellement' },
  { value: 'libre', label: 'Libre' },
]

const STATUT_COLORS: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  finalise: 'bg-green-100 text-green-700',
  envoye: 'bg-blue-100 text-blue-700',
}

export default function ReportsPage() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    patient_id: '',
    type: 'bilan_initial',
    prescripteur_nom: '',
    prescripteur_specialite: 'ORL',
    contexte_supplementaire: '',
  })
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsAPI.list().then(r => r.data),
  })

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsAPI.list().then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => reportsAPI.generate(form).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setShowForm(false)
      setForm({ patient_id: '', type: 'bilan_initial', prescripteur_nom: '', prescripteur_specialite: 'ORL', contexte_supplementaire: '' })
    },
  })

  const handlePreview = async (id: string) => {
    const { data } = await reportsAPI.getHtml(id)
    setPreviewHtml(data as unknown as string)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptes rendus</h1>
          <p className="text-gray-500 mt-1">Génération automatique par IA pour les prescripteurs</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" />
          Nouveau compte rendu
        </button>
      </div>

      {/* Formulaire de génération */}
      {showForm && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Générer un compte rendu par IA</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Patient *</label>
              <select
                className="input"
                value={form.patient_id}
                onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
              >
                <option value="">Sélectionner…</option>
                {patients?.map((p: Patient) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name.toUpperCase()} {p.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type de compte rendu *</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {REPORT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Prescripteur</label>
              <input
                className="input"
                placeholder="Dr Dupont"
                value={form.prescripteur_nom}
                onChange={(e) => setForm({ ...form, prescripteur_nom: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Spécialité</label>
              <select
                className="input"
                value={form.prescripteur_specialite}
                onChange={(e) => setForm({ ...form, prescripteur_specialite: e.target.value })}
              >
                <option value="ORL">ORL</option>
                <option value="Médecin généraliste">Médecin généraliste</option>
                <option value="Gériatre">Gériatre</option>
                <option value="Neurologue">Neurologue</option>
                <option value="Pédiatre">Pédiatre</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Contexte supplémentaire (optionnel)</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Informations spécifiques à inclure dans le compte rendu…"
                value={form.contexte_supplementaire}
                onChange={(e) => setForm({ ...form, contexte_supplementaire: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              className="btn-primary"
              onClick={() => generateMutation.mutate()}
              disabled={!form.patient_id || generateMutation.isPending}
            >
              {generateMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Génération par IA…</>
                : <><FileText className="w-4 h-4" />Générer</>
              }
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prescripteur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports?.map((r: Report) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.titre}</td>
                  <td className="px-4 py-3 text-gray-500">{REPORT_TYPES.find(t => t.value === r.type)?.label ?? r.type}</td>
                  <td className="px-4 py-3 text-gray-500">{r.prescripteur_nom || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(r.date_redaction), 'dd/MM/yyyy', { locale: fr })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUT_COLORS[r.statut]}`}>{r.statut}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        title="Aperçu HTML"
                        onClick={() => handlePreview(r.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={`/api/v1/reports/${r.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded hover:bg-blue-100 text-blue-600 hover:text-blue-800"
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {!reports?.length && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">Aucun compte rendu</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal aperçu HTML */}
      {previewHtml && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Aperçu du compte rendu</h2>
              <button className="btn-secondary" onClick={() => setPreviewHtml(null)}>Fermer</button>
            </div>
            <div
              className="p-6"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
