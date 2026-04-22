import axios from 'axios'
import type {
  User, Patient, Audiogram, HearingDevice, Order, Appointment, Report,
  FittingSituation, ChatMessage, Devis, Facture, BillingStats, LigneDevis
} from '@/types'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Intercepteur pour injecter le token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur pour gérer les 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; user: User }>(
      '/auth/login',
      new URLSearchParams({ username: email, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ),
  me: () => api.get<User>('/auth/me'),
  register: (data: Partial<User> & { password: string }) =>
    api.post<User>('/auth/register', data),
}

// ── Patients ──────────────────────────────────────────────────────────────────
export const patientsAPI = {
  list: (search?: string) =>
    api.get<Patient[]>('/patients', { params: search ? { search } : {} }),
  get: (id: string) => api.get<Patient>(`/patients/${id}`),
  create: (data: Partial<Patient>) => api.post<Patient>('/patients', data),
  update: (id: string, data: Partial<Patient>) => api.patch<Patient>(`/patients/${id}`, data),
  delete: (id: string) => api.delete(`/patients/${id}`),
  getAudiograms: (id: string) => api.get<Audiogram[]>(`/patients/${id}/audiograms`),
  getDevices: (id: string) => api.get<HearingDevice[]>(`/patients/${id}/devices`),
  addDevice: (id: string, data: {
    cote: 'droit' | 'gauche'
    marque: string
    modele: string
    reference?: string
    numero_serie?: string
    statut?: string
  }) => api.post<HearingDevice>(`/patients/${id}/devices`, data),
}

// ── Audiogrammes ──────────────────────────────────────────────────────────────
export const audiogramsAPI = {
  create: (data: Partial<Audiogram>) => api.post<Audiogram>('/audiograms', data),
  get: (id: string) => api.get<Audiogram>(`/audiograms/${id}`),
  delete: (id: string) => api.delete(`/audiograms/${id}`),
}

// ── Commandes ─────────────────────────────────────────────────────────────────
export const ordersAPI = {
  list: () => api.get<Order[]>('/orders'),
  get: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (data: Partial<Order> & { items: Partial<Order['items'][0]>[] }) =>
    api.post<Order>('/orders', data),
  update: (id: string, data: Partial<Order>) => api.patch<Order>(`/orders/${id}`, data),
  sendEdi: (id: string) => api.post<Order>(`/orders/${id}/send-edi`),
  previewEdi: (id: string) => api.get<{ edi_message: string }>(`/orders/${id}/edi-preview`),
}

// ── Réglage IA ────────────────────────────────────────────────────────────────
export const fittingAPI = {
  getSituations: () => api.get<{ categories: Record<string, FittingSituation[]>; total: number }>('/fitting/situations'),
  getSituation: (key: string) => api.get<FittingSituation>(`/fitting/situations/${key}`),
  createSession: (data: { patient_id: string; noah_session_id?: string }) =>
    api.post('/fitting/sessions', data),
  getSession: (id: string) => api.get(`/fitting/sessions/${id}`),
  getAiRecommendation: (data: {
    patient_id: string
    session_id: string
    situation_key: string
    feedback_patient?: string
    parametres_actuels?: Record<string, unknown>
  }) => api.post('/fitting/ai-recommendation', data),
  getPatientSessions: (patientId: string) =>
    api.get(`/fitting/patient/${patientId}/sessions`),
}

// ── Chatbot ───────────────────────────────────────────────────────────────────
export const chatbotAPI = {
  send: (messages: ChatMessage[], patient_context?: Record<string, unknown>) =>
    api.post<{ response: string }>('/chatbot', { messages, patient_context }),
}

// ── Comptes rendus ────────────────────────────────────────────────────────────
export const reportsAPI = {
  list: () => api.get<Report[]>('/reports'),
  get: (id: string) => api.get<Report>(`/reports/${id}`),
  generate: (data: {
    patient_id: string
    type: string
    audiogram_id?: string
    prescripteur_nom?: string
    prescripteur_specialite?: string
    contexte_supplementaire?: string
  }) => api.post<Report>('/reports/generate', data),
  update: (id: string, data: Partial<Report>) => api.patch<Report>(`/reports/${id}`, data),
  getHtml: (id: string) => api.get<string>(`/reports/${id}/html`),
  getPatientReports: (patientId: string) =>
    api.get<Report[]>(`/reports/patient/${patientId}`),
}

// ── Agenda ────────────────────────────────────────────────────────────────────
export const appointmentsAPI = {
  list: (params?: { date_debut?: string; date_fin?: string }) =>
    api.get<Appointment[]>('/appointments', { params }),
  create: (data: Partial<Appointment>) => api.post<Appointment>('/appointments', data),
  update: (id: string, data: Partial<Appointment>) =>
    api.patch<Appointment>(`/appointments/${id}`, data),
  delete: (id: string) => api.delete(`/appointments/${id}`),
}

// ── Catalogue ─────────────────────────────────────────────────────────────────
export const catalogAPI = {
  search: (params?: { q?: string; fabricant?: string; type_appareil?: string; classe_lpp?: number }) =>
    api.get('/catalog', { params }),
}

// ── Intégrations ──────────────────────────────────────────────────────────────
export const integrationsAPI = {
  status: () => api.get<Record<string, { connected: boolean; label: string }>>('/integrations/status'),
  noahPatients: () => api.get('/integrations/noah4/patients'),
  cosiumSearch: (nom: string) => api.get('/integrations/cosium/patients', { params: { nom } }),
  cosiumSyncPreview: (maxCosium = 200) =>
    api.get<CosiumSyncPreview>('/integrations/cosium/sync/preview', { params: { max_cosium: maxCosium } }),
  cosiumSyncApply: (links: { local_id: string; cosium_id: string }[]) =>
    api.post<{ applied: number; errors: string[] }>('/integrations/cosium/sync/apply', links),
  cosiumDebugLogin: () =>
    api.get<Record<string, unknown>>('/integrations/cosium/debug-login'),
}

export interface CosiumSyncMatch {
  cosium_id: string
  cosium_patient: {
    first_name: string
    last_name: string
    birth_date?: string
    nir?: string
    phone?: string
    email?: string
  }
  local_patient: {
    id: string
    first_name: string
    last_name: string
    birth_date?: string
    nir?: string
    cosium_id?: string
  } | null
  local_patient_id: string | null
  score: number
  auto_match: boolean
}

export interface CosiumSyncPreview {
  matches: CosiumSyncMatch[]
  unmatched_local: { id: string; first_name: string; last_name: string; birth_date?: string; nir?: string }[]
  total_cosium: number
  total_local: number
  total_csv_rows?: number
  headers_detected?: Record<string, number>
}

// ── Devis & Factures ──────────────────────────────────────────────────────────

export interface DevisCreatePayload {
  patient_id: string
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
  remboursement_secu?: number
  remboursement_mutuelle?: number
  lignes?: LigneDevis[]
  notes?: string
}

export interface FactureCreatePayload {
  patient_id: string
  devis_id?: string
  date_facture: string
  lignes?: LigneDevis[]
  notes?: string
}

export const billingAPI = {
  // Devis
  listDevis: (params?: { patient_id?: string; statut?: string }) =>
    api.get<Devis[]>('/billing/devis', { params }),
  getDevis: (id: string) => api.get<Devis>(`/billing/devis/${id}`),
  createDevis: (data: DevisCreatePayload) => api.post<Devis>('/billing/devis', data),
  updateDevis: (id: string, data: Partial<{ statut: string; remboursement_secu: number; remboursement_mutuelle: number; notes: string }>) =>
    api.patch<Devis>(`/billing/devis/${id}`, data),
  deleteDevis: (id: string) => api.delete(`/billing/devis/${id}`),
  getDevisPdfUrl: (id: string) => `/api/v1/billing/devis/${id}/pdf`,

  // Factures
  listFactures: (params?: { patient_id?: string; statut?: string }) =>
    api.get<Facture[]>('/billing/factures', { params }),
  getFacture: (id: string) => api.get<Facture>(`/billing/factures/${id}`),
  createFacture: (data: FactureCreatePayload) => api.post<Facture>('/billing/factures', data),
  updateFacture: (id: string, data: Partial<{ statut: string; montant_paye: number; notes: string }>) =>
    api.patch<Facture>(`/billing/factures/${id}`, data),
  deleteFacture: (id: string) => api.delete(`/billing/factures/${id}`),
  getFacturePdfUrl: (id: string) => `/api/v1/billing/factures/${id}/pdf`,

  // Stats
  stats: () => api.get<BillingStats>('/billing/stats'),
}

export default api
