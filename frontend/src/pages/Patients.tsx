import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { patientsAPI } from '@/services/api'
import api from '@/services/api'
import { Search, Plus, User, ChevronRight, X, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import type { Patient } from '@/types'

// ── Liste complète des mutuelles françaises ──────────────────────────────────
const MUTUELLES_FR = [
  // Réseaux de soins
  'Almerys', 'Viamedis', 'Santéclair', 'Oxantis', 'Séveane', 'Itelis',
  'Amelis', 'Kalixia', 'Kalivia', 'Carte Blanche Partenaires',
  // Mutuelles fonction publique / parapublique
  'MGEN', 'Mutuelle Générale', 'MACSF', 'MNH', 'MGEFI', 'Intériale',
  'MFP Services', 'MGPTT', 'MGA (Mutuelle Générale de l\'Armée)', 'Unéo',
  'AGPM', 'AGMF', 'MGP (Mutuelle de la Police)', 'MNPAF',
  'Mutuelle des Sapeurs-Pompiers', 'MNT (Mutuelle Nationale Territoriale)',
  // Assureurs / bancassureurs
  'AXA Santé', 'Allianz Santé', 'Generali Santé', 'Swiss Life Santé',
  'Groupama Santé', 'GAN Santé', 'Aviva France', 'Zurich Assurances',
  'Predica (Crédit Agricole)', 'BNP Paribas Assurance', 'CNP Assurances',
  'Caisse d\'Épargne Assurances', 'GMF Santé', 'MMA Santé', 'MAAF Santé',
  'MAIF Santé', 'MACIF Santé', 'Matmut Santé', 'Ociane Matmut', 'AMF Assurances',
  'April Santé', 'Alptis Assurances', 'Spvie', 'Meilleurtaux Santé',
  // Grandes mutuelles interpro
  'Harmonie Mutuelle', 'AG2R La Mondiale', 'Malakoff Humanis', 'Klesia',
  'Apicil', 'Humanis', 'Radiance Groupe Humanis', 'Pro BTP',
  'Audiens', 'B2V', 'Médéric', 'Novalis Taitbout', 'Chorum',
  'Mutex', 'Mutex (CCN Syntec)', 'Prévadiès', 'Uniprévoyance',
  'Eovi MCD Mutuelle', 'Adréa Mutuelle', 'Viasanté Mutuelle',
  'MGC Mutuelle', 'Mutuelle Bleue', 'CCMO Mutuelle',
  'Existence Mutuelle', 'Garance Mutuelle', 'Tutélaire',
  'Mutuelle Entrain', 'Previfrance', 'Solimut Mutuelle de France',
  'Mutuelle Just', 'Mutuelle Verte', 'Mutuelle des Pays de la Loire',
  'Mutuelle de Poitiers', 'Mutuelle Catalane', 'Cémutuel',
  'Pro Mutuelle', 'Mutuelle Solidarité', 'Creusois Mutuelle',
  'Mut-Est Mutuelle', 'Miltis Mutuelle', 'Mutuelle SMH',
  'Mutualité Française Anjou Mayenne', 'Mutuelle du Mans',
  'Isica', 'Quatrem', 'Réunica', 'Carac',
  // Prévoyance professionnelle
  'BTP Prévoyance', 'Carcept Prev', 'AGRICA', 'Capssa',
  // Mutuelles étudiantes
  'LMDE (La Mutuelle Des Étudiants)', 'SMENO', 'Smerep', 'MEP Mutuelle', 'SMEREP',
  // Régimes spéciaux / agricole
  'MSA (Mutualité Sociale Agricole)', 'MNRAS',
  // Autres
  'SMAM Mutuelle', 'SMIP', 'Solvay Mutuelle', 'ACMN Vie',
  'Eresam', 'Alliance Mutualiste', 'Santiaur Mutuelle',
  'GMP Mutuelle', 'Optam Mutuelle', 'Mutuelle des Motards (AREAS)',
  'Autre / Non renseignée',
].sort()

// ── Combobox mutuelles ────────────────────────────────────────────────────────
function MutuelleCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.length < 1
    ? MUTUELLES_FR
    : MUTUELLES_FR.filter(m => m.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className="input pr-8"
          placeholder="Rechercher une mutuelle…"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-sm">
          {filtered.map(m => (
            <li
              key={m}
              className={`px-3 py-2 cursor-pointer hover:bg-brand-50 ${m === value ? 'bg-brand-50 font-medium text-brand-700' : 'text-gray-700'}`}
              onMouseDown={() => { onChange(m); setQuery(m); setOpen(false) }}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Combobox prescripteur (recherche asynchrone) ──────────────────────────────
interface PrescripteurResult {
  nom: string
  rpps?: string
  adeli?: string
  specialite?: string
}

function PrescripteurCombobox({
  value, onChange, onSelect,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (p: PrescripteurResult) => void
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [debounced, setDebounced] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Debounce 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400)
    return () => clearTimeout(t)
  }, [query])

  const { data: results = [], isFetching } = useQuery<PrescripteurResult[]>({
    queryKey: ['prescripteurs', debounced],
    queryFn: () =>
      api.get<PrescripteurResult[]>('/prescripteurs', { params: { q: debounced } })
        .then(r => r.data),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className="input pr-8"
          placeholder="Rechercher un prescripteur…"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {isFetching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
        )}
        {!isFetching && <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-sm">
          {results.map(p => (
            <li
              key={p.rpps || p.adeli || p.nom}
              className="px-3 py-2 cursor-pointer hover:bg-brand-50 text-gray-700"
              onMouseDown={() => {
                onSelect(p)
                setQuery(p.nom)
                setOpen(false)
              }}
            >
              <span className="font-medium">{p.nom}</span>
              {p.specialite && <span className="text-gray-400 ml-2 text-xs">{p.specialite}</span>}
              {(p.rpps || p.adeli) && (
                <span className="text-gray-400 ml-2 text-xs font-mono">
                  {p.rpps ? `RPPS ${p.rpps}` : `Adeli ${p.adeli}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Modal création patient ────────────────────────────────────────────────────
function NewPatientModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: '', last_name: '', birth_date: '', gender: '',
    mobile: '', phone: '', email: '', address: '', city: '', postal_code: '',
    nir: '', mutuelle: '', lateralite: '', type_appareillage: '',
    prescripteur: '', prescripteur_rpps: '', prescripteur_adeli: '',
    date_ordonnance: '', notes: '',
  })
  const [dejaAppareille, setDejaAppareille] = useState(false)
  const [appareilOD, setAppareilOD] = useState({ marque: '', modele: '', reference: '', numero_serie: '' })
  const [appareilOG, setAppareilOG] = useState({ marque: '', modele: '', reference: '', numero_serie: '' })

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await patientsAPI.create({
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
        prescripteur_rpps: (data as any).prescripteur_rpps || undefined,
        prescripteur_adeli: (data as any).prescripteur_adeli || undefined,
        date_ordonnance: (data as any).date_ordonnance || undefined,
        notes: data.notes || undefined,
      })
      const patientId = res.data.id
      if (dejaAppareille) {
        if (appareilOD.marque && appareilOD.modele) {
          await patientsAPI.addDevice(patientId, { cote: 'droit', ...appareilOD, statut: 'adapte' })
        }
        if (appareilOG.marque && appareilOG.modele) {
          await patientsAPI.addDevice(patientId, { cote: 'gauche', ...appareilOG, statut: 'adapte' })
        }
      }
      return res.data
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate(`/patients/${patient.id}`)
    },
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const setDev = (side: 'od' | 'og', k: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (side === 'od') setAppareilOD(p => ({ ...p, [k]: e.target.value }))
      else setAppareilOG(p => ({ ...p, [k]: e.target.value }))
    }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form) }} className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Identité */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Identité</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nom *</label><input className="input" value={form.last_name} onChange={set('last_name')} required /></div>
              <div><label className="label">Prénom *</label><input className="input" value={form.first_name} onChange={set('first_name')} required /></div>
              <div><label className="label">Date de naissance *</label><input type="date" className="input" value={form.birth_date} onChange={set('birth_date')} required /></div>
              <div>
                <label className="label">Sexe</label>
                <select className="input" value={form.gender} onChange={set('gender')}>
                  <option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option>
                </select>
              </div>
              <div className="col-span-2"><label className="label">NIR (n° sécurité sociale)</label><input className="input" value={form.nir} onChange={set('nir')} placeholder="1 85 12 75 123 456 78" /></div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Mobile</label><input className="input" value={form.mobile} onChange={set('mobile')} placeholder="06 00 00 00 00" /></div>
              <div><label className="label">Téléphone fixe</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="01 00 00 00 00" /></div>
              <div className="col-span-2"><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
              <div className="col-span-2"><label className="label">Adresse</label><input className="input" value={form.address} onChange={set('address')} /></div>
              <div><label className="label">Code postal</label><input className="input" value={form.postal_code} onChange={set('postal_code')} /></div>
              <div><label className="label">Ville</label><input className="input" value={form.city} onChange={set('city')} /></div>
            </div>
          </section>

          {/* Audiologie */}
          <section>
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
                  <option value="RITE">Contour RITE</option>
                  <option value="BTE">Contour BTE</option>
                  <option value="ITE">Intra ITE</option>
                  <option value="ITC">Intra ITC</option>
                  <option value="CIC">Intra CIC</option>
                  <option value="IIC">Intra IIC (invisible)</option>
                  <option value="CROS">CROS</option>
                  <option value="BiCROS">BiCROS</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Date de l'ordonnance</label>
                <input
                  type="date"
                  className="input"
                  value={form.date_ordonnance}
                  onChange={set('date_ordonnance')}
                />
              </div>
              <div className="col-span-2">
                <label className="label">Prescripteur</label>
                <PrescripteurCombobox
                  value={form.prescripteur}
                  onChange={v => setForm(f => ({ ...f, prescripteur: v, prescripteur_rpps: '', prescripteur_adeli: '' }))}
                  onSelect={p => setForm(f => ({
                    ...f,
                    prescripteur: p.nom,
                    prescripteur_rpps: p.rpps || '',
                    prescripteur_adeli: p.adeli || '',
                  }))}
                />
              </div>
              {(form.prescripteur_rpps || form.prescripteur_adeli) && (
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-gray-400">RPPS</label>
                    <input className="input bg-gray-50 text-gray-500 font-mono text-sm" readOnly value={form.prescripteur_rpps} />
                  </div>
                  <div>
                    <label className="label text-gray-400">ADELI</label>
                    <input className="input bg-gray-50 text-gray-500 font-mono text-sm" readOnly value={form.prescripteur_adeli} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Appareils existants */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Appareillage actuel</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`w-9 h-5 rounded-full transition-colors ${dejaAppareille ? 'bg-brand-600' : 'bg-gray-200'}`}
                  onClick={() => setDejaAppareille(v => !v)}
                >
                  <div className={`w-4 h-4 mt-0.5 ml-0.5 rounded-full bg-white shadow transition-transform ${dejaAppareille ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-gray-600">Patient déjà appareillé</span>
              </label>
            </div>
            {dejaAppareille && (
              <div className="grid grid-cols-2 gap-4">
                {/* OD */}
                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-600 uppercase">Oreille droite (OD)</p>
                  <div><label className="label">Marque</label><input className="input" value={appareilOD.marque} onChange={setDev('od', 'marque')} placeholder="ex: Phonak, Oticon…" /></div>
                  <div><label className="label">Modèle</label><input className="input" value={appareilOD.modele} onChange={setDev('od', 'modele')} placeholder="ex: Audéo Lumity" /></div>
                  <div><label className="label">Référence</label><input className="input" value={appareilOD.reference} onChange={setDev('od', 'reference')} placeholder="ex: P90-R" /></div>
                  <div><label className="label">N° de série</label><input className="input" value={appareilOD.numero_serie} onChange={setDev('od', 'numero_serie')} /></div>
                </div>
                {/* OG */}
                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-green-600 uppercase">Oreille gauche (OG)</p>
                  <div><label className="label">Marque</label><input className="input" value={appareilOG.marque} onChange={setDev('og', 'marque')} placeholder="ex: Phonak, Oticon…" /></div>
                  <div><label className="label">Modèle</label><input className="input" value={appareilOG.modele} onChange={setDev('og', 'modele')} placeholder="ex: Audéo Lumity" /></div>
                  <div><label className="label">Référence</label><input className="input" value={appareilOG.reference} onChange={setDev('og', 'reference')} placeholder="ex: P90-L" /></div>
                  <div><label className="label">N° de série</label><input className="input" value={appareilOG.numero_serie} onChange={setDev('og', 'numero_serie')} /></div>
                </div>
              </div>
            )}
          </section>

          {/* Mutuelle */}
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mutuelle</p>
            <MutuelleCombobox value={form.mutuelle} onChange={v => setForm(f => ({ ...f, mutuelle: v }))} />
          </section>

          {/* Notes */}
          <section>
            <label className="label">Notes</label>
            <textarea className="input min-h-[72px] resize-none" value={form.notes} onChange={set('notes')} />
          </section>

          {mutation.isError && (
            <p className="text-sm text-red-600">Erreur lors de la création du patient.</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
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

// ── Page liste patients ───────────────────────────────────────────────────────
const LATERALITE_LABELS: Record<string, string> = {
  bilateral: 'Bilatéral', droit: 'Droit', gauche: 'Gauche',
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-10 w-full max-w-md"
          placeholder="Rechercher par nom, prénom ou NIR…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/patients/${p.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-brand-600" />
                      </div>
                      <span className="font-medium text-gray-900">{p.last_name.toUpperCase()} {p.first_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(p.birth_date), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3 text-gray-500">{p.mobile || p.phone || '—'}</td>
                  <td className="px-4 py-3">
                    {p.type_appareillage
                      ? <span className="badge bg-brand-100 text-brand-700">{p.type_appareillage}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.lateralite ? LATERALITE_LABELS[p.lateralite] : '—'}</td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-400" /></td>
                </tr>
              ))}
              {!patients?.length && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Aucun patient trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
