import { useQuery } from '@tanstack/react-query'
import { patientsAPI, ordersAPI, appointmentsAPI, integrationsAPI } from '@/services/api'
import { Users, ShoppingCart, Calendar, Wifi, WifiOff, TrendingUp } from 'lucide-react'
import { format, startOfDay, endOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'

function StatCard({
  title, value, icon: Icon, color
}: { title: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsAPI.list().then(r => r.data),
  })

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersAPI.list().then(r => r.data),
  })

  const { data: appointments } = useQuery({
    queryKey: ['appointments-today'],
    queryFn: () => appointmentsAPI.list({ date_debut: today, date_fin: today }).then(r => r.data),
  })

  const { data: integrations } = useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => integrationsAPI.status().then(r => r.data),
    refetchInterval: 30_000,
  })

  const pendingOrders = orders?.filter(o => ['brouillon', 'envoyee', 'confirmee'].includes(o.statut))?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Patients actifs" value={patients?.length ?? '—'} icon={Users} color="bg-brand-600" />
        <StatCard title="RDV aujourd'hui" value={appointments?.length ?? '—'} icon={Calendar} color="bg-green-600" />
        <StatCard title="Commandes en cours" value={pendingOrders} icon={ShoppingCart} color="bg-orange-500" />
        <StatCard title="Sessions réglage ce mois" value="—" icon={TrendingUp} color="bg-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RDV du jour */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Rendez-vous du jour</h2>
          </div>
          <div className="p-4">
            {appointments && appointments.length > 0 ? (
              <ul className="space-y-2">
                {appointments.map(a => (
                  <li key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="text-sm font-medium text-brand-600 w-12 flex-shrink-0">
                      {format(new Date(a.debut), 'HH:mm')}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {a.patient_id}
                      </div>
                      <div className="text-xs text-gray-500">{a.type}</div>
                    </div>
                    <span className={`ml-auto badge ${
                      a.statut === 'confirme' ? 'bg-green-100 text-green-700' :
                      a.statut === 'planifie' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {a.statut}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">Aucun rendez-vous aujourd'hui</p>
            )}
          </div>
        </div>

        {/* Statut intégrations */}
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Statut des intégrations</h2>
          </div>
          <div className="p-4 space-y-3">
            {integrations
              ? Object.entries(integrations).map(([key, info]) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-700">{info.label}</span>
                    <div className={`flex items-center gap-1.5 text-sm ${info.connected ? 'text-green-600' : 'text-red-500'}`}>
                      {info.connected
                        ? <><Wifi className="w-4 h-4" /> Connecté</>
                        : <><WifiOff className="w-4 h-4" /> Déconnecté</>
                      }
                    </div>
                  </div>
                ))
              : (
                <p className="text-gray-400 text-sm">Vérification en cours…</p>
              )
            }
          </div>
        </div>
      </div>

      {/* Dernières commandes */}
      {orders && orders.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Dernières commandes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabricant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant TTC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.slice(0, 5).map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.numero_commande}</td>
                    <td className="px-4 py-3 font-medium">{o.fabricant}</td>
                    <td className="px-4 py-3">{o.montant_ttc.toFixed(2)} €</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        o.statut === 'livree' ? 'bg-green-100 text-green-700' :
                        o.statut === 'envoyee' ? 'bg-blue-100 text-blue-700' :
                        o.statut === 'brouillon' ? 'bg-gray-100 text-gray-600' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {o.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {format(new Date(o.created_at), 'dd/MM/yyyy')}
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
