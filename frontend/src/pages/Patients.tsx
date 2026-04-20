import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { patientsAPI } from '@/services/api'
import { Search, Plus, User, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import type { Patient } from '@/types'

const LATERALITE_LABELS: Record<string, string> = {
  bilateral: 'Bilatéral',
  droit: 'Droit',
  gauche: 'Gauche',
}

export default function PatientsPage() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsAPI.list(search || undefined).then(r => r.data),
    staleTime: 10_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">{patients?.length ?? 0} patients</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/patients/new')}>
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
