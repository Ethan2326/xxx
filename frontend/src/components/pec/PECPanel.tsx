import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pecAPI } from '@/services/pecAPI'
import {
  ShieldCheck, Plus, Mail, Globe, Phone, ChevronDown, ChevronUp,
  Upload, Trash2, Send, Eye, X, Loader2, AlertCircle, CheckCircle,
  FileText, CreditCard, Stethoscope, Ear, ExternalLink, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Patient } from '@/types'
import type { PEC, MutuelleInfo, StatutPEC } from '@/types/pec'
import {
  STATUT_LABELS, STATUT_COLORS, TYPE_DEMANDE_LABELS, DOC_LABELS
} from '@/types/pec'

// ─── Icône document ────────────────────────────────────────────────────────────
function DocIcon({ type }: { type: string }) {
  if (type === 'devis') return <FileText className="w-4 h-4 text-brand-600" />
  if (type === 'ordonnance') return <Stethoscope className="w-4 h-4 text-green-600" />
  if (type === 'carte_mutuelle') return <CreditCard className="w-4 h-4 text-orange-500" />
  if (type === 'audiogramme') return <Ear className="w-4 h-4 text-purple-600" />
  return <FileText className="w-4 h-4 text-gray-500" />
}

// ─── Badge réseau coloré ──────────────────────────────────────────────────────
function ReseauBadge({ mutuelle }: { mutuelle?: MutuelleInfo | null }) {
  if (!mutuelle) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: mutuelle.couleur }}
    >
      {mutuelle.reseau_label}
    </span>
  )
}

// ─── Modal prévisualisation email ─────────────────────────────────────────────
function EmailPreviewModal({
  pecId,
  onClose,
  onSend,
}: {
  pecId: string
  onClose: () => void
  onSend: (emailOverride?: string, cc?: string) => void
}) {
  const [emailOverride, setEmailOverride] = useState('')
  const [emailCc, setEmailCc] = useState('')

  const { data: preview, isLoading } = useQuery({
    queryKey: ['pec-preview', pecId],
    queryFn: () => pecAPI.previewEmail(pecId).then(r => r.data),
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-brand-600" />
            Prévisualisation de l'email PEC
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : preview ? (
          <>
            {/* Infos envoi */}
            <div className="p-5 border-b border-gray-100 bg-gray-50 space-y-3 flex-shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Destinataire *</label>
                  <input
                    className="input text-sm"
                    value={emailOverride || preview.to || ''}
                    onChange={e => setEmailOverride(e.target.value)}
                    placeholder="email@mutuelle.fr"
                  />
                  {preview.mutuelle_info?.email_pec && (
                    <p className="text-xs text-gray-400 mt-1">
                      Auto-détecté : {preview.mutuelle_info.email_pec}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label text-xs">CC (optionnel)</label>
                  <input
                    className="input text-sm"
                    value={emailCc}
                    onChange={e => setEmailCc(e.target.value)}
                    placeholder="votre@centre.fr"
                  />
                </div>
              </div>
              <div>
                <label className="label text-xs">Objet</label>
                <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  {preview.subject}
                </div>
              </div>
              {/* Pièces jointes */}
              <div>
                <label className="label text-xs">
                  Pièces jointes ({preview.documents_joints?.length ?? 0})
                  {preview.documents_requis?.length > 0 && (
                    <span className="text-gray-400 font-normal ml-2">
                      — Requis : {preview.documents_requis.map((d: string) => DOC_LABELS[d] ?? d).join(', ')}
                    </span>
                  )}
                </label>
                {preview.documents_joints?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {preview.documents_joints.map((d: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-xs">
                        <DocIcon type={d.type} />
                        {d.nom}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Aucun document joint — uploadez les pièces avant envoi
                  </div>
                )}
              </div>
            </div>

            {/* Corps email */}
            <div className="flex-1 overflow-y-auto p-4">
              <div
                className="text-sm border border-gray-200 rounded-xl overflow-hidden"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button
                className="btn-primary flex-1 justify-center"
                onClick={() => onSend(emailOverride || preview.to, emailCc)}
              >
                <Send className="w-4 h-4" />
                Envoyer la demande de PEC
              </button>
              <button className="btn-secondary" onClick={onClose}>Annuler</button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── Formulaire nouvelle PEC ──────────────────────────────────────────────────
function NewPECForm({
  patient,
  onClose,
  onCreated,
}: {
  patient: Patient
  onClose: () => void
  onCreated: (pec: PEC) => void
}) {
  const [mutuelleQuery, setMutuelleQuery] = useState(patient.mutuelle || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [form, setForm] = useState({
    mutuelle_nom: patient.mutuelle || '',
    reseau_tiers_payant: '',
    numero_adherent: patient.numero_adherent_mutuelle || '',
    type_demande: 'nouvel_appareillage' as const,
    methode: 'email' as const,
    classe_lpp: 1,
    montant_demande_od: undefined as number | undefined,
    montant_demande_og: undefined as number | undefined,
    base_remboursement: undefined as number | undefined,
    email_destinataire: '',
    notes: '',
  })
  const [detectedMutuelle, setDetectedMutuelle] = useState<MutuelleInfo | null>(null)

  const { data: mutuelles } = useQuery({
    queryKey: ['mutuelles', mutuelleQuery],
    queryFn: () => pecAPI.listMutuelles(mutuelleQuery).then(r => r.data),
    enabled: mutuelleQuery.length >= 2,
  })

  const createMutation = useMutation({
    mutationFn: () => pecAPI.create({ ...form, patient_id: patient.id }).then(r => r.data),
    onSuccess: (pec) => onCreated(pec),
  })

  const selectMutuelle = (m: MutuelleInfo) => {
    setDetectedMutuelle(m)
    setForm({
      ...form,
      mutuelle_nom: m.nom,
      reseau_tiers_payant: m.reseau,
      email_destinataire: m.email_pec || '',
    })
    setMutuelleQuery(m.nom)
    setShowSuggestions(false)
  }

  return (
    <div className="p-5 space-y-4">
      <h3 className="font-semibold text-gray-800">Nouvelle demande de PEC</h3>

      {/* Recherche mutuelle */}
      <div className="relative">
        <label className="label">Mutuelle *</label>
        <input
          className="input"
          value={mutuelleQuery}
          onChange={e => {
            setMutuelleQuery(e.target.value)
            setForm({ ...form, mutuelle_nom: e.target.value })
            setShowSuggestions(true)
            setDetectedMutuelle(null)
          }}
          placeholder="Rechercher une mutuelle (ex : Harmonie, Almerys, Malakoff…)"
          autoComplete="off"
        />
        {showSuggestions && mutuelles && mutuelles.length > 0 && (
          <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
            {mutuelles.map(m => (
              <li key={m.nom}>
                <button
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 flex items-center justify-between gap-3"
                  onClick={() => selectMutuelle(m)}
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{m.nom}</span>
                    {m.email_pec && (
                      <span className="text-xs text-gray-500 ml-2">{m.email_pec}</span>
                    )}
                  </div>
                  <span
                    className="badge text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: m.couleur }}
                  >
                    {m.reseau_label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Infos détectées */}
      {detectedMutuelle && (
        <div className="p-3 rounded-xl border flex flex-col gap-2 text-sm" style={{ borderColor: detectedMutuelle.couleur + '44', backgroundColor: detectedMutuelle.couleur + '0d' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <ReseauBadge mutuelle={detectedMutuelle} />
            {detectedMutuelle.procedure_portail && (
              <span className="badge bg-blue-100 text-blue-700">Portail web disponible</span>
            )}
            {detectedMutuelle.procedure_email && (
              <span className="badge bg-green-100 text-green-700">Email PEC</span>
            )}
            <span className="text-gray-500 text-xs">Délai : {detectedMutuelle.delai_reponse_jours}j</span>
          </div>
          {detectedMutuelle.email_pec && (
            <div className="flex items-center gap-1.5 text-gray-600 text-xs">
              <Mail className="w-3.5 h-3.5" /> {detectedMutuelle.email_pec}
            </div>
          )}
          {detectedMutuelle.telephone && (
            <div className="flex items-center gap-1.5 text-gray-600 text-xs">
              <Phone className="w-3.5 h-3.5" /> {detectedMutuelle.telephone}
            </div>
          )}
          {detectedMutuelle.notes && (
            <div className="flex items-start gap-1.5 text-amber-700 text-xs bg-amber-50 rounded px-2 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {detectedMutuelle.notes}
            </div>
          )}
          <div className="text-xs text-gray-500">
            Documents requis : {detectedMutuelle.documents_requis.map(d => DOC_LABELS[d] ?? d).join(', ')}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type de demande</label>
          <select className="input" value={form.type_demande} onChange={e => setForm({ ...form, type_demande: e.target.value as any })}>
            <option value="nouvel_appareillage">Nouvel appareillage</option>
            <option value="renouvellement">Renouvellement</option>
            <option value="sav">SAV</option>
            <option value="accessoires">Accessoires</option>
          </select>
        </div>
        <div>
          <label className="label">Classe LPP</label>
          <select className="input" value={form.classe_lpp} onChange={e => setForm({ ...form, classe_lpp: parseInt(e.target.value) })}>
            <option value="1">Classe 1 (100% Santé)</option>
            <option value="2">Classe 2 (liberté de choix)</option>
          </select>
        </div>
        <div>
          <label className="label">N° adhérent mutuelle</label>
          <input className="input" value={form.numero_adherent} onChange={e => setForm({ ...form, numero_adherent: e.target.value })} placeholder="123456789" />
        </div>
        <div>
          <label className="label">Email destinataire</label>
          <input className="input" value={form.email_destinataire} onChange={e => setForm({ ...form, email_destinataire: e.target.value })} placeholder="Auto-détecté" />
        </div>
        <div>
          <label className="label">Montant demandé OD (€)</label>
          <input type="number" step="0.01" className="input" value={form.montant_demande_od || ''} onChange={e => setForm({ ...form, montant_demande_od: parseFloat(e.target.value) || undefined })} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Montant demandé OG (€)</label>
          <input type="number" step="0.01" className="input" value={form.montant_demande_og || ''} onChange={e => setForm({ ...form, montant_demande_og: parseFloat(e.target.value) || undefined })} placeholder="0.00" />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Informations complémentaires…" />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          className="btn-primary"
          onClick={() => createMutation.mutate()}
          disabled={!form.mutuelle_nom || createMutation.isPending}
        >
          {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Création…</> : 'Créer la PEC'}
        </button>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

// ─── Carte PEC ────────────────────────────────────────────────────────────────
function PECCard({
  pec,
  patientId,
  onRefresh,
}: {
  pec: PEC
  patientId: string
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const mutuelleInfo = useQuery({
    queryKey: ['mutuelle-detect', pec.mutuelle_nom],
    queryFn: () => pecAPI.detectMutuelle(pec.mutuelle_nom).then(r => r.data).catch(() => null),
    staleTime: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof pecAPI.update>[1]) => pecAPI.update(pec.id, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pec', patientId] }); onRefresh() },
  })

  const deleteMutation = useMutation({
    mutationFn: () => pecAPI.delete(pec.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pec', patientId] }); onRefresh() },
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => pecAPI.deleteDocument(pec.id, docId),
    onSuccess: () => onRefresh(),
  })

  const handleUpload = async (type: string, file: File) => {
    setUploadingType(type)
    try {
      await pecAPI.uploadDocument(pec.id, file, type)
      onRefresh()
    } finally {
      setUploadingType(null)
    }
  }

  const handleSendEmail = async (emailOverride?: string, cc?: string) => {
    setSendingEmail(true)
    setShowEmailPreview(false)
    try {
      await pecAPI.sendEmail(pec.id, {
        email_destinataire: emailOverride,
        email_cc: cc,
      })
      onRefresh()
    } finally {
      setSendingEmail(false)
    }
  }

  const requiredDocs = mutuelleInfo.data?.documents_requis ?? ['devis', 'ordonnance', 'carte_mutuelle']
  const uploadedTypes = pec.documents.map(d => d.type_document)
  const missingDocs = requiredDocs.filter(d => !uploadedTypes.includes(d))
  const totalMontant = (pec.montant_demande_od || 0) + (pec.montant_demande_og || 0)
  const totalAccorde = (pec.montant_accorde_od || 0) + (pec.montant_accorde_og || 0)

  return (
    <>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Header carte */}
        <div className="flex items-center gap-3 p-4 bg-white">
          <button
            className="flex-1 flex items-center gap-3 text-left min-w-0"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{pec.mutuelle_nom}</span>
                <ReseauBadge mutuelle={mutuelleInfo.data} />
                <span className={`badge ${STATUT_COLORS[pec.statut]}`}>
                  {STATUT_LABELS[pec.statut]}
                </span>
                {pec.classe_lpp && (
                  <span className="badge bg-indigo-100 text-indigo-700">Classe {pec.classe_lpp}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                <span>{TYPE_DEMANDE_LABELS[pec.type_demande]}</span>
                {pec.reference_pec && <span className="font-mono">{pec.reference_pec}</span>}
                {totalMontant > 0 && <span>{totalMontant.toFixed(2)} € demandé</span>}
                {totalAccorde > 0 && (
                  <span className="text-green-600 font-medium">{totalAccorde.toFixed(2)} € accordé</span>
                )}
                <span>{format(new Date(pec.created_at), 'dd/MM/yyyy', { locale: fr })}</span>
              </div>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          </button>

          {/* Actions rapides */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Portail web */}
            {mutuelleInfo.data?.portail_url && (
              <a
                href={mutuelleInfo.data.portail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                title={`Ouvrir ${mutuelleInfo.data.portail_label}`}
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
            {/* Bouton email PEC */}
            {pec.statut === 'brouillon' && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                onClick={() => setShowEmailPreview(true)}
                disabled={sendingEmail}
                title="Envoyer la demande de PEC par email"
              >
                {sendingEmail
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Mail className="w-3.5 h-3.5" />
                }
                Demande PEC par mail
              </button>
            )}
            {pec.statut === 'en_attente' && pec.email_envoye_at && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Envoyé le {format(new Date(pec.email_envoye_at), 'dd/MM', { locale: fr })}
              </span>
            )}
          </div>
        </div>

        {/* Corps étendu */}
        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
            {/* Alerte documents manquants */}
            {missingDocs.length > 0 && pec.statut === 'brouillon' && (
              <div className="flex items-start gap-2 text-amber-700 text-xs bg-amber-50 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Pièces manquantes avant envoi :&nbsp;
                  <strong>{missingDocs.map(d => DOC_LABELS[d] ?? d).join(', ')}</strong>
                </span>
              </div>
            )}

            {/* Upload documents */}
            <div>
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Pièces jointes
              </h4>
              <div className="flex flex-wrap gap-2">
                {requiredDocs.map(docType => {
                  const existing = pec.documents.find(d => d.type_document === docType)
                  return (
                    <div key={docType} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                      existing ? 'bg-green-50 border-green-200' : 'bg-white border-dashed border-gray-300'
                    }`}>
                      <DocIcon type={docType} />
                      <span className={existing ? 'text-green-700' : 'text-gray-500'}>
                        {DOC_LABELS[docType] ?? docType}
                      </span>
                      {existing ? (
                        <>
                          <span className="text-xs text-green-600 max-w-24 truncate">{existing.nom_fichier}</span>
                          <button
                            className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600"
                            onClick={() => deleteDocMutation.mutate(existing.id)}
                            title="Supprimer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <label className="cursor-pointer p-0.5 rounded hover:bg-brand-100 text-brand-500">
                            {uploadingType === docType
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Upload className="w-3.5 h-3.5" />
                            }
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) handleUpload(docType, f)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mise à jour statut + référence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Mettre à jour le statut</label>
                <div className="flex gap-2 flex-wrap">
                  {(['en_attente', 'accordee', 'accordee_partielle', 'refusee', 'annulee'] as StatutPEC[]).map(s => (
                    <button
                      key={s}
                      className={`badge cursor-pointer hover:opacity-80 transition-opacity px-2.5 py-1 ${
                        pec.statut === s
                          ? STATUT_COLORS[s] + ' ring-2 ring-offset-1 ring-current'
                          : STATUT_COLORS[s] + ' opacity-60'
                      }`}
                      onClick={() => updateMutation.mutate({ statut: s })}
                    >
                      {STATUT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label text-xs">Référence mutuelle</label>
                <div className="flex gap-2">
                  <input
                    className="input text-sm flex-1"
                    defaultValue={pec.reference_mutuelle || ''}
                    placeholder="Réf. donnée par la mutuelle"
                    id={`ref-${pec.id}`}
                  />
                  <button
                    className="btn-secondary py-1 px-2 text-xs"
                    onClick={() => {
                      const val = (document.getElementById(`ref-${pec.id}`) as HTMLInputElement)?.value
                      if (val) updateMutation.mutate({ reference_mutuelle: val })
                    }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Montants accordés */}
            {['accordee', 'accordee_partielle'].includes(pec.statut) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Montant accordé OD (€)</label>
                  <input
                    type="number" step="0.01" className="input text-sm"
                    defaultValue={pec.montant_accorde_od || ''}
                    placeholder="0.00"
                    id={`acc-od-${pec.id}`}
                  />
                </div>
                <div>
                  <label className="label text-xs">Montant accordé OG (€)</label>
                  <input
                    type="number" step="0.01" className="input text-sm"
                    defaultValue={pec.montant_accorde_og || ''}
                    placeholder="0.00"
                    id={`acc-og-${pec.id}`}
                  />
                </div>
                <button
                  className="btn-primary col-span-2 justify-center text-sm py-2"
                  onClick={() => updateMutation.mutate({
                    montant_accorde_od: parseFloat((document.getElementById(`acc-od-${pec.id}`) as HTMLInputElement)?.value) || undefined,
                    montant_accorde_og: parseFloat((document.getElementById(`acc-og-${pec.id}`) as HTMLInputElement)?.value) || undefined,
                  })}
                >
                  Enregistrer les montants accordés
                </button>
              </div>
            )}

            {/* Infos de contact réseau */}
            {mutuelleInfo.data && (
              <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-gray-200 flex-wrap">
                {mutuelleInfo.data.telephone && (
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {mutuelleInfo.data.telephone}</span>
                )}
                {mutuelleInfo.data.email_pec && (
                  <a href={`mailto:${mutuelleInfo.data.email_pec}`} className="flex items-center gap-1 hover:text-brand-600">
                    <Mail className="w-3.5 h-3.5" /> {mutuelleInfo.data.email_pec}
                  </a>
                )}
                {mutuelleInfo.data.portail_url && (
                  <a href={mutuelleInfo.data.portail_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-brand-600">
                    <ExternalLink className="w-3.5 h-3.5" /> {mutuelleInfo.data.portail_label || 'Portail web'}
                  </a>
                )}
                <span>Délai estimé : {mutuelleInfo.data.delai_reponse_jours}j</span>
              </div>
            )}

            {/* Supprimer */}
            <div className="pt-1">
              <button
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                onClick={() => {
                  if (confirm('Supprimer cette demande de PEC ?')) deleteMutation.mutate()
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer la PEC
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal email */}
      {showEmailPreview && (
        <EmailPreviewModal
          pecId={pec.id}
          onClose={() => setShowEmailPreview(false)}
          onSend={handleSendEmail}
        />
      )}
    </>
  )
}

// ─── PECPanel principal ───────────────────────────────────────────────────────
export default function PECPanel({ patient }: { patient: Patient }) {
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()

  const { data: pecs, isLoading, refetch } = useQuery({
    queryKey: ['pec', patient.id],
    queryFn: () => pecAPI.getPatientPEC(patient.id).then(r => r.data),
  })

  const handlePECCreated = (pec: PEC) => {
    queryClient.invalidateQueries({ queryKey: ['pec', patient.id] })
    setShowForm(false)
    // Auto-ouvrir la carte créée pour guider l'utilisateur
  }

  const accordees = pecs?.filter(p => ['accordee', 'accordee_partielle'].includes(p.statut)) ?? []
  const en_attente = pecs?.filter(p => p.statut === 'en_attente') ?? []
  const brouillons = pecs?.filter(p => p.statut === 'brouillon') ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-600" />
          <h2 className="font-semibold text-gray-900">Prises en charge mutuelles</h2>
          <div className="flex gap-1">
            {accordees.length > 0 && (
              <span className="badge bg-green-100 text-green-700">{accordees.length} accordée{accordees.length > 1 ? 's' : ''}</span>
            )}
            {en_attente.length > 0 && (
              <span className="badge bg-blue-100 text-blue-700">{en_attente.length} en attente</span>
            )}
          </div>
        </div>
        <button
          className="btn-primary text-sm py-1.5"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4" />
          Nouvelle PEC
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="card overflow-hidden">
          <NewPECForm
            patient={patient}
            onClose={() => setShowForm(false)}
            onCreated={handlePECCreated}
          />
        </div>
      )}

      {/* Liste des PEC */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Chargement…</div>
      ) : pecs && pecs.length > 0 ? (
        <div className="space-y-2">
          {pecs.map(pec => (
            <PECCard
              key={pec.id}
              pec={pec}
              patientId={patient.id}
              onRefresh={() => refetch()}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          Aucune demande de prise en charge
        </div>
      )}
    </div>
  )
}
