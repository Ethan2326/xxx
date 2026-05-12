import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, String, Integer, DateTime, Text, ForeignKey, Enum, Boolean, Float
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base


class CampaignStatus(str, PyEnum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class LeadStatus(str, PyEnum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    disqualified = "disqualified"


class EngagementType(str, PyEnum):
    like = "like"
    comment = "comment"


class LinkedInCampaign(Base):
    __tablename__ = "linkedin_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    competitor_linkedin_url = Column(String(512), nullable=False)
    target_keywords = Column(ARRAY(String), default=[])
    max_posts = Column(Integer, default=10)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.pending, nullable=False)
    error_message = Column(Text, nullable=True)
    leads_count = Column(Integer, default=0)
    posts_scraped = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_run_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    posts = relationship("ScrapedPost", back_populates="campaign", cascade="all, delete-orphan")
    leads = relationship("LinkedInLead", back_populates="campaign", cascade="all, delete-orphan")


class ScrapedPost(Base):
    __tablename__ = "linkedin_scraped_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("linkedin_campaigns.id", ondelete="CASCADE"), nullable=False)
    post_urn = Column(String(255), nullable=True)
    post_url = Column(String(1024), nullable=True)
    post_text = Column(Text, nullable=True)
    posted_at = Column(DateTime, nullable=True)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    scraped_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("LinkedInCampaign", back_populates="posts")
    engagements = relationship("LeadEngagement", back_populates="post", cascade="all, delete-orphan")


class LinkedInLead(Base):
    __tablename__ = "linkedin_leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("linkedin_campaigns.id", ondelete="CASCADE"), nullable=False)
    linkedin_url = Column(String(512), nullable=False)
    full_name = Column(String(255), nullable=True)
    headline = Column(String(512), nullable=True)
    company = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    profile_picture_url = Column(String(1024), nullable=True)
    score = Column(Integer, default=0)
    engagement_count = Column(Integer, default=0)
    last_engagement_at = Column(DateTime, nullable=True)
    status = Column(Enum(LeadStatus), default=LeadStatus.new, nullable=False)
    notes = Column(Text, nullable=True)
    is_keyword_match = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("LinkedInCampaign", back_populates="leads")
    engagements = relationship("LeadEngagement", back_populates="lead", cascade="all, delete-orphan")


class LeadEngagement(Base):
    __tablename__ = "linkedin_lead_engagements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("linkedin_leads.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("linkedin_scraped_posts.id", ondelete="CASCADE"), nullable=False)
    engagement_type = Column(Enum(EngagementType), nullable=False)
    comment_text = Column(Text, nullable=True)
    engaged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("LinkedInLead", back_populates="engagements")
    post = relationship("ScrapedPost", back_populates="engagements")
