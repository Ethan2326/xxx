import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { integrationsAPI } from '@/services/api'
import { useAuthStore } from '@/store'
import { Settings, Wifi, WifiOff, User, Building, Shield, RefreshCw, Upload, Download, Bug } from 'lucide-react'
import CosiumSyncModal from '@/components/cosium/CosiumSyncModal'
import CosiumCsvImportModal from '@/components/cosium/CosiumCsvImportModal'
import CosiumImportModal from '@/components/cosium/CosiumImportModal'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [showCosiumSync, setShowCosiumSync] = useState(false)
  const [showCosiumCsv, setShowCosiumCsv] = useState(false)
  const [showCosiumImport, setShowCosiumImport] = useState(false)
  const [cosiumDebug, setCosiumDebug] = useState<Record<string, unknown> | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)

  const { data: integrations, refetch } = useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => integrationsAPI.status().then(r => r.data),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Configuration et intégrations</p>
      </div>

      {/* Profil utilisateur */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-brand-600" /> Mon profil
        </h2>
        {user && (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Nom', `${user.first_name} ${user.last_name}`],
              ['Email', user.email],
              ['Rôle', user.role],
              ['Centre', user.centre || '—'],
              ['N° RPPS', user.rpps_number || '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{val}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Intégrations */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-600" /> Intégrations logicielles
          </h2>
          <button className="btn-secondary text-xs" onClick={() => refetch()}>
            Actualiser
          </button>
        </div>
        <div className="space-y-3">
          {integrations
            ? Object.entries(integrations).map(([key, info]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-medium text-sm text-gray-800">{info.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {key === 'noah4' && 'Gestion audiogrammes et réglages (HIMSA)'}
                      {key === 'audiowizard' && 'Gestion de cabinet audioprothétique'}
                      {key === 'cosium' && 'ERP opticiens-audioprothésistes'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {key === 'cosium' && (
                      <div className="flex gap-2 flex-wrap justify-end">
                        <button
                          className="btn-primary text-xs flex items-center gap-1.5"
                          onClick={() => setShowCosiumImport(true)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Importer les patients
                        </button>
                        <button
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          onClick={() => setShowCosiumCsv(true)}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Import CSV
                        </button>
                        <button
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          disabled={debugLoading}
                          onClick={async () => {
                            setDebugLoading(true)
                            try {
                              const r = await integrationsAPI.cosiumDebugLogin()
                              setCosiumDebug(r.data)
                            } catch(e: any) {
                              setCosiumDebug({ erreur: e?.response?.data?.detail || String(e) })
                            } finally {
                              setDebugLoading(false)
                            }
                          }}
                        >
                          <Bug className="w-3.5 h-3.5" />
                          {debugLoading ? 'Test…' : 'Tester'}
                        </button>
                      </div>
                    )}
                    <div className={`flex items-center gap-2 text-sm font-medium ${info.connected ? 'text-green-600' : 'text-red-500'}`}>
                      {info.connected
                        ? <><Wifi className="w-4 h-4" /> Connecté</>
                        : <><WifiOff className="w-4 h-4" /> Non connecté</>
                      }
                    </div>
                  </div>
                </div>
              ))
            : <div className="text-gray-400 text-sm">Chargement…</div>
          }
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Configuration dans le fichier .env (variables NOAH4_HOST, AUDIOWIZARD_URL, COSIUM_URL, COSIUM_USERNAME, COSIUM_PASSWORD)
        </p>
      </div>

      {/* EDI */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-600" /> Configuration EDI
        </h2>
        <div className="space-y-2 text-sm">
          <p className="text-gray-600">
            Les commandes EDI utilisent le standard <strong>EDIFACT ORDERS D.96A</strong>
            transmis par SFTP ou AS2 selon les fabricants.
          </p>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-700 text-xs">
            <strong>Fabricants supportés :</strong> Phonak, Oticon, Signia, ReSound, Widex, Starkey, Unitron, Bernafon, Beltone, Interton
          </div>
        </div>
      </div>

      {showCosiumSync   && <CosiumSyncModal onClose={() => setShowCosiumSync(false)} />}
      {showCosiumCsv    && <CosiumCsvImportModal onClose={() => setShowCosiumCsv(false)} />}
      {showCosiumImport && <CosiumImportModal onClose={() => setShowCosiumImport(false)} />}

      {/* Debug Cosium */}
      {cosiumDebug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-gray-900">Diagnostic connexion Cosium</h3>
              <button onClick={() => setCosiumDebug(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            <pre className="overflow-auto p-5 text-xs text-gray-700 bg-gray-50 rounded-b-2xl flex-1">
              {JSON.stringify(cosiumDebug, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* RGPD */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-600" /> Conformité RGPD
        </h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
            <span>Données hébergées en France — HDS (Hébergeur de Données de Santé)</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
            <span>Chiffrement des données au repos (AES-256) et en transit (TLS 1.3)</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
            <span>Journalisation des accès aux données de santé (piste d'audit)</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
            <span>Droit à l'effacement et portabilité des données patient</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
            <span>Déclaration CNIL à effectuer lors du déploiement</span>
          </div>
        </div>
      </div>
    </div>
  )
}
