export interface MutuelleInfo {
  nom: string
  reseau: string
  reseau_label: string
  email_pec?: string
  portail_url?: string
  portail_label?: string
  telephone?: string
  procedure_email: boolean
  procedure_portail: boolean
  documents_requis: string[]
  delai_reponse_jours: number
  notes?: string
  couleur: string
}

export type StatutPEC =
  | 'brouillon'
  | 'en_attente'
  | 'accordee'
  | 'accordee_partielle'
  | 'refusee'
  | 'annulee'
  | 'expiree'

export type MethodePEC = 'portail_web' | 'email' | 'telephone' | 'courrier'
export type TypeDemande = 'nouvel_appareillage' | 'renouvellement' | 'sav' | 'accessoires'

export interface DocumentPEC {
  id: string
  pec_id: string
  type_document: string
  nom_fichier: string
  mime_type: string
  taille_octets?: number
  created_at: string
}

export interface PEC {
  id: string
  patient_id: string
  author_id: string
  mutuelle_nom: string
  reseau_tiers_payant?: string
  numero_adherent?: string
  type_demande: TypeDemande
  methode: MethodePEC
  statut: StatutPEC
  classe_lpp?: number
  appareil_od_reference?: string
  appareil_og_reference?: string
  montant_demande_od?: number
  montant_demande_og?: number
  montant_accorde_od?: number
  montant_accorde_og?: number
  base_remboursement?: number
  reference_pec?: string
  reference_mutuelle?: string
  numero_dossier_mutuelle?: string
  email_destinataire?: string
  email_envoye_at?: string
  email_objet?: string
  date_demande?: string
  date_reponse?: string
  date_validite?: string
  motif_refus?: string
  notes?: string
  documents: DocumentPEC[]
  created_at: string
}

export interface PECCreate {
  patient_id: string
  mutuelle_nom: string
  reseau_tiers_payant?: string
  numero_adherent?: string
  type_demande?: TypeDemande
  methode?: MethodePEC
  classe_lpp?: number
  appareil_od_reference?: string
  appareil_og_reference?: string
  montant_demande_od?: number
  montant_demande_og?: number
  base_remboursement?: number
  email_destinataire?: string
  notes?: string
}

export interface PECUpdate {
  statut?: StatutPEC
  reference_mutuelle?: string
  numero_dossier_mutuelle?: string
  montant_accorde_od?: number
  montant_accorde_og?: number
  date_validite?: string
  motif_refus?: string
  notes?: string
}

export const STATUT_LABELS: Record<StatutPEC, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  accordee: 'Accordée',
  accordee_partielle: 'Accordée partiellement',
  refusee: 'Refusée',
  annulee: 'Annulée',
  expiree: 'Expirée',
}

export const STATUT_COLORS: Record<StatutPEC, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  en_attente: 'bg-blue-100 text-blue-700',
  accordee: 'bg-green-100 text-green-700',
  accordee_partielle: 'bg-yellow-100 text-yellow-700',
  refusee: 'bg-red-100 text-red-700',
  annulee: 'bg-gray-100 text-gray-500',
  expiree: 'bg-orange-100 text-orange-700',
}

export const TYPE_DEMANDE_LABELS: Record<TypeDemande, string> = {
  nouvel_appareillage: 'Nouvel appareillage',
  renouvellement: 'Renouvellement',
  sav: 'SAV',
  accessoires: 'Accessoires',
}

export const DOC_LABELS: Record<string, string> = {
  devis: 'Devis',
  ordonnance: 'Ordonnance',
  carte_mutuelle: 'Carte mutuelle',
  audiogramme: 'Audiogramme',
  autre: 'Autre document',
}
