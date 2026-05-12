import axios from 'axios';
import type {
  LinkedInCampaign,
  CampaignCreate,
  CampaignStats,
  LinkedInLead,
  LeadListResponse,
  LeadStatus,
} from '../types/linkedin';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const api = axios.create({ baseURL: `${BASE}/api/v1/linkedin` });

// ── Campaigns ────────────────────────────────────────────────────────────────

export const getCampaigns = () =>
  api.get<LinkedInCampaign[]>('/campaigns').then((r) => r.data);

export const createCampaign = (payload: CampaignCreate) =>
  api.post<LinkedInCampaign>('/campaigns', payload).then((r) => r.data);

export const deleteCampaign = (id: string) =>
  api.delete(`/campaigns/${id}`);

export const runCampaign = (id: string) =>
  api.post<LinkedInCampaign>(`/campaigns/${id}/run`).then((r) => r.data);

export const getCampaignStats = (id: string) =>
  api.get<CampaignStats>(`/campaigns/${id}/stats`).then((r) => r.data);

// ── Leads ────────────────────────────────────────────────────────────────────

export interface LeadFilters {
  status?: LeadStatus;
  category?: 'hot' | 'warm' | 'cold';
  keyword_match?: boolean;
  sort_by?: 'score' | 'name' | 'last_engagement';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export const getLeads = (campaignId: string, filters: LeadFilters = {}) =>
  api
    .get<LeadListResponse>(`/campaigns/${campaignId}/leads`, { params: filters })
    .then((r) => r.data);

export const updateLeadStatus = (leadId: string, status: LeadStatus, notes?: string) =>
  api
    .patch<LinkedInLead>(`/leads/${leadId}`, { status, notes })
    .then((r) => r.data);

// ── Export ───────────────────────────────────────────────────────────────────

export const exportCsv = (campaignId: string, campaignName: string) => {
  const url = `${BASE}/api/v1/linkedin/campaigns/${campaignId}/export/csv`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads_${campaignName}.csv`;
  a.click();
};

export const exportExcel = (campaignId: string, campaignName: string) => {
  const url = `${BASE}/api/v1/linkedin/campaigns/${campaignId}/export/excel`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads_${campaignName}.xlsx`;
  a.click();
};
