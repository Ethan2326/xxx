export type CampaignStatus = 'pending' | 'running' | 'completed' | 'failed';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified';
export type EngagementType = 'like' | 'comment';
export type LeadCategory = 'hot' | 'warm' | 'cold';

export interface LinkedInCampaign {
  id: string;
  name: string;
  competitor_linkedin_url: string;
  target_keywords: string[];
  max_posts: number;
  status: CampaignStatus;
  error_message: string | null;
  leads_count: number;
  posts_scraped: number;
  created_at: string;
  last_run_at: string | null;
  completed_at: string | null;
}

export interface CampaignCreate {
  name: string;
  competitor_linkedin_url: string;
  target_keywords: string[];
  max_posts: number;
}

export interface LeadEngagement {
  id: string;
  post_id: string;
  engagement_type: EngagementType;
  comment_text: string | null;
  engaged_at: string | null;
}

export interface LinkedInLead {
  id: string;
  campaign_id: string;
  linkedin_url: string;
  full_name: string | null;
  headline: string | null;
  company: string | null;
  job_title: string | null;
  location: string | null;
  profile_picture_url: string | null;
  score: number;
  engagement_count: number;
  last_engagement_at: string | null;
  status: LeadStatus;
  notes: string | null;
  is_keyword_match: boolean;
  created_at: string;
  engagements: LeadEngagement[];
}

export interface LeadListResponse {
  total: number;
  items: LinkedInLead[];
}

export interface CampaignStats {
  campaign: LinkedInCampaign;
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  keyword_matches: number;
  engagement_breakdown: Record<string, number>;
}
