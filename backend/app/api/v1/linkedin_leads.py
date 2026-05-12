from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
import io

from app.database import get_db
from app.models.linkedin_lead import (
    LinkedInCampaign, ScrapedPost, LinkedInLead, LeadEngagement,
    CampaignStatus, LeadStatus,
)
from app.schemas.linkedin_lead import (
    CampaignCreate, CampaignRead, CampaignUpdate, CampaignStats,
    LinkedInLeadRead, LeadStatusUpdate, LeadListResponse, ScrapedPostRead,
)
from app.services.lead_exporter import leads_to_csv, leads_to_excel
from app.services.lead_scorer import classify_lead

router = APIRouter(prefix="/linkedin", tags=["LinkedIn Leads"])


# ── Campaigns ─────────────────────────────────────────────────────────────────

@router.get("/campaigns", response_model=list[CampaignRead])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LinkedInCampaign).order_by(LinkedInCampaign.created_at.desc())
    )
    return result.scalars().all()


@router.post("/campaigns", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db)):
    campaign = LinkedInCampaign(**payload.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/campaigns/{campaign_id}", response_model=CampaignRead)
async def get_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(campaign_id, db)
    return campaign


@router.patch("/campaigns/{campaign_id}", response_model=CampaignRead)
async def update_campaign(
    campaign_id: UUID, payload: CampaignUpdate, db: AsyncSession = Depends(get_db)
):
    campaign = await _get_campaign_or_404(campaign_id, db)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(campaign, field, val)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(campaign_id, db)
    await db.delete(campaign)
    await db.commit()


@router.post("/campaigns/{campaign_id}/run", response_model=CampaignRead)
async def run_campaign(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(campaign_id, db)
    if campaign.status == CampaignStatus.running:
        raise HTTPException(status_code=409, detail="Campaign already running")

    from app.tasks_linkedin import run_linkedin_campaign
    run_linkedin_campaign.delay(str(campaign_id))

    campaign.status = CampaignStatus.pending
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/campaigns/{campaign_id}/stats", response_model=CampaignStats)
async def campaign_stats(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(campaign_id, db)
    leads_result = await db.execute(
        select(LinkedInLead).where(LinkedInLead.campaign_id == campaign_id)
    )
    leads = leads_result.scalars().all()

    hot = sum(1 for l in leads if l.score >= 50)
    warm = sum(1 for l in leads if 20 <= l.score < 50)
    cold = sum(1 for l in leads if l.score < 20)
    kw_match = sum(1 for l in leads if l.is_keyword_match)

    eng_result = await db.execute(
        select(LeadEngagement.engagement_type, func.count())
        .join(LinkedInLead)
        .where(LinkedInLead.campaign_id == campaign_id)
        .group_by(LeadEngagement.engagement_type)
    )
    breakdown = {row[0].value: row[1] for row in eng_result.all()}

    return CampaignStats(
        campaign=CampaignRead.model_validate(campaign),
        total_leads=len(leads),
        hot_leads=hot,
        warm_leads=warm,
        cold_leads=cold,
        keyword_matches=kw_match,
        engagement_breakdown=breakdown,
    )


# ── Posts ─────────────────────────────────────────────────────────────────────

@router.get("/campaigns/{campaign_id}/posts", response_model=list[ScrapedPostRead])
async def list_posts(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScrapedPost)
        .where(ScrapedPost.campaign_id == campaign_id)
        .order_by(ScrapedPost.posted_at.desc())
    )
    return result.scalars().all()


# ── Leads ─────────────────────────────────────────────────────────────────────

@router.get("/campaigns/{campaign_id}/leads", response_model=LeadListResponse)
async def list_leads(
    campaign_id: UUID,
    status: Optional[LeadStatus] = None,
    category: Optional[str] = Query(None, description="hot | warm | cold"),
    keyword_match: Optional[bool] = None,
    sort_by: str = Query("score", description="score | name | last_engagement"),
    order: str = Query("desc", description="asc | desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(LinkedInLead)
        .where(LinkedInLead.campaign_id == campaign_id)
        .options(selectinload(LinkedInLead.engagements))
    )

    if status:
        query = query.where(LinkedInLead.status == status)
    if keyword_match is not None:
        query = query.where(LinkedInLead.is_keyword_match == keyword_match)
    if category == "hot":
        query = query.where(LinkedInLead.score >= 50)
    elif category == "warm":
        query = query.where(LinkedInLead.score >= 20, LinkedInLead.score < 50)
    elif category == "cold":
        query = query.where(LinkedInLead.score < 20)

    # Sorting
    sort_col = {
        "score": LinkedInLead.score,
        "name": LinkedInLead.full_name,
        "last_engagement": LinkedInLead.last_engagement_at,
    }.get(sort_by, LinkedInLead.score)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    # Count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    leads = result.scalars().all()

    return LeadListResponse(total=total, items=leads)


@router.patch("/leads/{lead_id}", response_model=LinkedInLeadRead)
async def update_lead_status(
    lead_id: UUID, payload: LeadStatusUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LinkedInLead)
        .where(LinkedInLead.id == lead_id)
        .options(selectinload(LinkedInLead.engagements))
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead introuvable")
    lead.status = payload.status
    if payload.notes is not None:
        lead.notes = payload.notes
    await db.commit()
    await db.refresh(lead)
    return lead


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/campaigns/{campaign_id}/export/csv")
async def export_csv(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(campaign_id, db)
    result = await db.execute(
        select(LinkedInLead)
        .where(LinkedInLead.campaign_id == campaign_id)
        .order_by(LinkedInLead.score.desc())
    )
    leads = result.scalars().all()
    data = leads_to_csv(leads)
    filename = f"leads_{campaign.name.replace(' ', '_')}.csv"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/campaigns/{campaign_id}/export/excel")
async def export_excel(campaign_id: UUID, db: AsyncSession = Depends(get_db)):
    campaign = await _get_campaign_or_404(campaign_id, db)
    result = await db.execute(
        select(LinkedInLead)
        .where(LinkedInLead.campaign_id == campaign_id)
        .order_by(LinkedInLead.score.desc())
    )
    leads = result.scalars().all()
    data = leads_to_excel(leads, campaign_name=campaign.name)
    filename = f"leads_{campaign.name.replace(' ', '_')}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Helper ────────────────────────────────────────────────────────────────────

async def _get_campaign_or_404(campaign_id: UUID, db: AsyncSession) -> LinkedInCampaign:
    result = await db.execute(
        select(LinkedInCampaign).where(LinkedInCampaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign introuvable")
    return campaign
