import api from './api'
import type { MutuelleInfo, PEC, PECCreate, PECUpdate, DocumentPEC } from '@/types/pec'

export const pecAPI = {
  // Mutuelles
  listMutuelles: (search?: string) =>
    api.get<MutuelleInfo[]>('/pec/mutuelles', { params: search ? { search } : {} }),
  detectMutuelle: (nom: string) =>
    api.get<MutuelleInfo>('/pec/mutuelles/detect', { params: { nom } }),

  // PEC CRUD
  getPatientPEC: (patientId: string) =>
    api.get<PEC[]>(`/pec/patient/${patientId}`),
  create: (data: PECCreate) =>
    api.post<PEC>('/pec', data),
  update: (id: string, data: PECUpdate) =>
    api.patch<PEC>(`/pec/${id}`, data),
  delete: (id: string) =>
    api.delete(`/pec/${id}`),

  // Documents
  uploadDocument: (pecId: string, file: File, typeDocument: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type_document', typeDocument)
    return api.post<DocumentPEC>(`/pec/${pecId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteDocument: (pecId: string, docId: string) =>
    api.delete(`/pec/${pecId}/documents/${docId}`),

  // Email
  previewEmail: (pecId: string) =>
    api.get(`/pec/${pecId}/email-preview`),
  sendEmail: (pecId: string, data: {
    email_destinataire?: string
    email_cc?: string
    documents?: { type_document: string; nom_fichier: string; mime_type: string; contenu: string }[]
  }) => api.post(`/pec/${pecId}/send-email`, data),
}
