from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.models.linkedin_lead import CampaignStatus, LeadStatus, EngagementType


# ─── Campaign ─────────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    competitor_linkedin_url: str
    target_keywords: List[str] = []
    max_posts: int = 10

    @field_validator("max_posts")
    @classmethod
    def clamp_max_posts(cls, v: int) -> int:
        return max(1, min(v, 50))


class CampaignRead(BaseModel):
    id: UUID
    name: str
    competitor_linkedin_url: str
    target_keywords: List[str]
    max_posts: int
    status: CampaignStatus
    error_message: Optional[str]
    leads_count: int
    posts_scraped: int
    created_at: datetime
    last_run_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    target_keywords: Optional[List[str]] = None
    max_posts: Optional[int] = None


# ─── Post ─────────────────────────────────────────────────────────────────────

class ScrapedPostRead(BaseModel):
    id: UUID
    campaign_id: UUID
    post_url: Optional[str]
    post_text: Optional[str]
    posted_at: Optional[datetime]
    likes_count: int
    comments_count: int
    scraped_at: datetime

    model_config = {"from_attributes": True}


# ─── Engagement ───────────────────────────────────────────────────────────────

class LeadEngagementRead(BaseModel):
    id: UUID
    post_id: UUID
    engagement_type: EngagementType
    comment_text: Optional[str]
    engaged_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ─── Lead ─────────────────────────────────────────────────────────────────────

class LinkedInLeadRead(BaseModel):
    id: UUID
    campaign_id: UUID
    linkedin_url: str
    full_name: Optional[str]
    headline: Optional[str]
    company: Optional[str]
    job_title: Optional[str]
    location: Optional[str]
    profile_picture_url: Optional[str]
    score: int
    engagement_count: int
    last_engagement_at: Optional[datetime]
    status: LeadStatus
    notes: Optional[str]
    is_keyword_match: bool
    created_at: datetime
    engagements: List[LeadEngagementRead] = []

    model_config = {"from_attributes": True}


class LeadStatusUpdate(BaseModel):
    status: LeadStatus
    notes: Optional[str] = None


# ─── Export / Stats ───────────────────────────────────────────────────────────

class CampaignStats(BaseModel):
    campaign: CampaignRead
    total_leads: int
    hot_leads: int       # score >= 50
    warm_leads: int      # score 20-49
    cold_leads: int      # score < 20
    keyword_matches: int
    engagement_breakdown: dict  # {"like": n, "comment": n}


class LeadListResponse(BaseModel):
    total: int
    items: List[LinkedInLeadRead]
