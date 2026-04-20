import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientsAPI } from '@/services/api'
import { Search, Plus, User, ChevronRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import type { Patient } from '@/types'

const LATERALITE_LABELS: Record<string, string> = {
  bilateral: 'Bilatéral',
  droit: 'Droit',
  gauche: 'Gauche',
}

function NewPatientModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    mobile: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    postal_code: '',
    nir: '',
    mutuelle: '',
    lateralite: '',
    type_appareillage: '',
    prescripteur: '',
    notes: '',
  })

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      patientsAPI.create({
        ...data,
        gender: data.gender || undefined,
        mobile: data.mobile || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        postal_code: data.postal_code || undefined,
        nir: data.nir || undefined,
        mutuelle: data.mutuelle || undefined,
        lateralite: (data.lateralite as any) || undefined,
        type_appareillage: (data.type_appareillage as any) || undefined,
        prescripteur: data.prescripteur || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate(`/patients/${res.data.id}`)
    },
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.birth_date) return
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Identité */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Identité</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nom *</label>
                <input className="input" value={form.last_name} onChange={set('last_name')} required />
              </div>
              <div>
                <label className="label">Prénom *</label>
                <input className="input" value={form.first_name} onChange={set('first_name')} required />
              </div>
              <div>
                <label className="label">Date de naissance *</label>
                <input type="date" className="input" value={form.birth_date} onChange={set('birth_date')} required />
              </div>
              <div>
                <label className="label">Sexe</label>
                <select className="input" value={form.gender} onChange={set('gender')}>
                  <option value="">—</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">NIR (n° sécurité sociale)</label>
                <input className="input" value={form.nir} onChange={set('nir')} placeholder="1 85 12 75 123 456 78" />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mobile</label>
                <input className="input" value={form.mobile} onChange={set('mobile')} placeholder="06 00 00 00 00" />
              </div>
              <div>
                <label className="label">Téléphone fixe</label>
                <input className="input" value={form.phone} onChange={set('phone')} placeholder="01 00 00 00 00" />
              </div>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={set('email')} />
              </div>
              <div className="col-span-2">
                <label className="label">Adresse</label>
                <input className="input" value={form.address} onChange={set('address')} />
              </div>
              <div>
                <label className="label">Code postal</label>
                <input className="input" value={form.postal_code} onChange={set('postal_code')} />
              </div>
              <div>
                <label className="label">Ville</label>
                <input className="input" value={form.city} onChange={set('city')} />
              </div>
            </div>
          </div>

          {/* Audiologie */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Audiologie</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Latéralité</label>
                <select className="input" value={form.lateralite} onChange={set('lateralite')}>
                  <option value="">—</option>
                  <option value="bilateral">Bilatéral</option>
                  <option value="droit">Droit</option>
                  <option value="gauche">Gauche</option>
                </select>
              </div>
              <div>
                <label className="label">Type d'appareillage</label>
                <select className="input" value={form.type_appareillage} onChange={set('type_appareillage')}>
                  <option value="">—</option>
                  <option value="contour">Contour d'oreille</option>
                  <option value="intra">Intra-auriculaire</option>
                  <option value="ric">RIC / RITE</option>
                  <option value="baha">BAHA</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Prescripteur</label>
                <input className="input" value={form.prescripteur} onChange={set('prescripteur')} placeholder="Dr. Dupont" />
              </div>
            </div>
          </div>

          {/* Mutuelle */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mutuelle</p>
            <div>
              <label className="label">Mutuelle</label>
              <input className="input" value={form.mutuelle} onChange={set('mutuelle')} placeholder="ex: MGEN, Almerys, Harmonie..." />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[80px] resize-none" value={form.notes} onChange={set('notes')} />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">Erreur lors de la création du patient.</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Création…' : 'Créer le patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PatientsPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsAPI.list(search || undefined).then(r => r.data),
    staleTime: 10_000,
  })

  return (
    <div className="space-y-6">
      {showModal && <NewPatientModal onClose={() => setShowModal(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">{patients?.length ?? 0} patients</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" />
          Nouveau patient
        </button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-10 w-full max-w-md"
          placeholder="Rechercher par nom, prénom ou NIR…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Naissance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Appareillage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latéralité</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {patients?.map((p: Patient) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-brand-600" />
                      </div>
                      <span className="font-medium text-gray-900">
                        {p.last_name.toUpperCase()} {p.first_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(p.birth_date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.mobile || p.phone || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.type_appareillage ? (
                      <span className="badge bg-brand-100 text-brand-700">{p.type_appareillage}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.lateralite ? LATERALITE_LABELS[p.lateralite] : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              ))}
              {!patients?.length && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Aucun patient trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
