export type UserRole = 'admin' | 'audioprothesiste' | 'secretaire' | 'stagiaire'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  centre?: string
  rpps_number?: string
  is_active: boolean
  created_at: string
}

export interface Patient {
  id: string
  noah_id?: string
  cosium_id?: string
  first_name: string
  last_name: string
  birth_date: string
  gender?: string
  nir?: string
  email?: string
  phone?: string
  mobile?: string
  address?: string
  city?: string
  postal_code?: string
  lateralite?: 'bilateral' | 'droit' | 'gauche'
  type_appareillage?: string
  prescripteur?: string
  prescripteur_rpps?: string
  prescripteur_adeli?: string
  date_ordonnance?: string
  mutuelle?: string
  numero_adherent_mutuelle?: string
  notes?: string
  created_at: string
}

export interface Audiogram {
  id: string
  patient_id: string
  type: 'tonal' | 'vocal' | 'impedancemetrie' | 'oea' | 'pea'
  date_mesure: string
  seuils_od_ca?: Record<string, number>
  seuils_od_co?: Record<string, number>
  seuils_og_ca?: Record<string, number>
  seuils_og_co?: Record<string, number>
  vocal_od_intelligibilite?: number
  vocal_og_intelligibilite?: number
  vocal_od_sds?: number
  vocal_og_sds?: number
  tymp_od?: string
  tymp_og?: string
  perte_moyenne_od?: number
  perte_moyenne_og?: number
  classification_od?: string
  classification_og?: string
  commentaire?: string
  created_at: string
}

export interface DeviceCatalog {
  id: string
  fabricant: string
  marque: string
  modele: string
  reference: string
  ean?: string
  type_appareil?: string
  niveau_technologie?: string
  prix_achat_ht?: number
  prix_vente_conseille?: number
  classe_lpp?: number
  caracteristiques?: Record<string, unknown>
  edi_code?: string
}

export interface HearingDevice {
  id: string
  patient_id: string
  catalog_id?: string
  cote: 'droit' | 'gauche' | 'bilateral'
  statut: 'en_essai' | 'commande' | 'livre' | 'adapte' | 'retourne' | 'en_sav'
  numero_serie?: string
  prix_vente_ht?: number
  base_remboursement?: number
  remboursement_secu?: number
  remboursement_mutuelle?: number
  reste_a_charge?: number
  notes_sav?: string
  date_attribution?: string
  date_fin_garantie?: string
  catalog?: DeviceCatalog
  created_at: string
}

export interface OrderItem {
  id: string
  reference: string
  designation: string
  quantite: number
  prix_unitaire_ht?: number
  remise_pct: number
  montant_ht?: number
  numero_serie?: string
  motif_sav?: string
}

export type OrderStatus =
  | 'brouillon' | 'envoyee' | 'confirmee'
  | 'en_preparation' | 'expediee' | 'livree'
  | 'annulee' | 'retour'

export interface Order {
  id: string
  numero_commande: string
  patient_id?: string
  type: 'neuf' | 'sav' | 'retour' | 'consommable'
  statut: OrderStatus
  fabricant: string
  edi_message_id?: string
  edi_sent_at?: string
  edi_confirmed_at?: string
  edi_reference_fournisseur?: string
  date_livraison_souhaitee?: string
  date_livraison_reelle?: string
  montant_ht: number
  montant_tva: number
  montant_ttc: number
  notes?: string
  items: OrderItem[]
  created_at: string
}

export interface Appointment {
  id: string
  patient_id: string
  user_id: string
  type: string
  statut: string
  debut: string
  fin: string
  duree_minutes: number
  salle?: string
  notes?: string
  rappel_envoye: boolean
  created_at: string
}

export interface Report {
  id: string
  patient_id: string
  author_id: string
  audiogram_id?: string
  type: string
  statut: 'brouillon' | 'finalise' | 'envoye'
  titre: string
  prescripteur_nom?: string
  prescripteur_rpps?: string
  prescripteur_specialite?: string
  contenu_json?: string
  contenu_html?: string
  date_redaction: string
  date_envoi?: string
  created_at: string
}

export interface FittingSituation {
  key: string
  label: string
  categorie: string
  description: string
  niveau_bruit_moyen_db: number
  parametres_sugges: Record<string, unknown>
  conseils: string
  indicateurs_satisfaction: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface IntegrationStatus {
  connected: boolean
  label: string
}

export interface LigneDevis {
  designation: string
  quantite: number
  prix_ht: number
  tva: number
}

export interface Devis {
  id: string
  patient_id: string
  patient_nom?: string
  numero: string
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire' | 'facture'
  date_devis: string
  date_validite?: string
  appareil_od_marque?: string
  appareil_od_modele?: string
  appareil_od_reference?: string
  appareil_od_classe_lpp?: number
  appareil_od_prix_ht?: number
  appareil_og_marque?: string
  appareil_og_modele?: string
  appareil_og_reference?: string
  appareil_og_classe_lpp?: number
  appareil_og_prix_ht?: number
  base_remboursement_secu?: number
  remboursement_secu?: number
  remboursement_mutuelle?: number
  reste_a_charge?: number
  lignes_json?: string
  montant_total_ht?: number
  montant_tva?: number
  montant_ttc?: number
  notes?: string
  created_at: string
}

export interface Facture {
  id: string
  patient_id: string
  patient_nom?: string
  devis_id?: string
  numero: string
  statut: 'emise' | 'payee' | 'partiellement_payee' | 'annulee'
  date_facture: string
  montant_ttc?: number
  montant_paye?: number
  reste_a_payer?: number
  lignes_json?: string
  notes?: string
  created_at: string
}

export interface BillingStats {
  nb_devis: number
  total_devis_ttc: number
  nb_factures: number
  total_factures_ttc: number
  reste_a_encaisser: number
}
