"""
Celery tasks for LinkedIn lead scraping.

Flow per campaign:
  1. run_linkedin_campaign  → marks campaign as running
  2. For each post scraped  → calls process_post_engagements
  3. Saves leads + scores   → marks campaign as completed
"""
import asyncio
import logging
from uuid import UUID
from datetime import datetime

from app.celery_app import celery_app
from app.services.linkedin_scraper import LinkedInScraper, EngagementData
from app.services.lead_scorer import compute_score

log = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks_linkedin.run_linkedin_campaign",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def run_linkedin_campaign(self, campaign_id: str):
    """Main task: scrape a competitor and persist leads."""
    asyncio.run(_run_campaign_async(campaign_id))


async def _run_campaign_async(campaign_id: str):
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from app.config import get_settings
    from app.database import AsyncSessionLocal
    from app.models.linkedin_lead import (
        LinkedInCampaign, ScrapedPost, LinkedInLead, LeadEngagement,
        CampaignStatus, EngagementType,
    )
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    settings = get_settings()
    scraper = LinkedInScraper()

    async with AsyncSessionLocal() as db:
        # Fetch campaign
        result = await db.execute(
            select(LinkedInCampaign).where(LinkedInCampaign.id == campaign_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            log.error("Campaign not found: %s", campaign_id)
            return

        campaign.status = CampaignStatus.running
        campaign.last_run_at = datetime.utcnow()
        await db.flush()

        try:
            # 1. Scrape posts
            posts_data = await scraper.get_company_posts(
                campaign.competitor_linkedin_url,
                max_posts=campaign.max_posts,
            )
            log.info("Scraped %d posts for campaign %s", len(posts_data), campaign_id)

            # lead_map: linkedin_url → {lead, engagements_list}
            lead_map: dict[str, dict] = {}

            for post_data in posts_data:
                # Persist post
                post = ScrapedPost(
                    campaign_id=campaign.id,
                    post_urn=post_data.post_urn,
                    post_url=post_data.post_url,
                    post_text=post_data.post_text,
                    posted_at=post_data.posted_at,
                    likes_count=post_data.likes_count,
                    comments_count=post_data.comments_count,
                )
                db.add(post)
                await db.flush()  # get post.id

                # 2. Scrape engagements
                engagements = await scraper.get_post_engagements(
                    post_data.post_urn or "",
                    post_data.post_url,
                )

                for eng in engagements:
                    if not eng.linkedin_url:
                        continue
                    url = eng.linkedin_url.rstrip("/")

                    if url not in lead_map:
                        lead_map[url] = {"data": eng, "engagements": [], "post_ids": []}

                    lead_map[url]["engagements"].append(eng)
                    lead_map[url]["post_ids"].append(post.id)

                    # Persist engagement placeholder — lead_id filled below
                    lead_map[url].setdefault("pending_engagements", []).append(
                        (post.id, eng)
                    )

            # 3. Persist leads and their engagements
            saved_leads = 0
            for url, info in lead_map.items():
                eng_list: list[EngagementData] = info["engagements"]
                first: EngagementData = info["data"]

                score, is_kw = compute_score(
                    eng_list,
                    campaign.target_keywords or [],
                    first.headline,
                )
                last_dt = max(
                    (e.engaged_at for e in eng_list if e.engaged_at),
                    default=None,
                )

                # Check if lead already exists for this campaign
                existing = await db.execute(
                    select(LinkedInLead).where(
                        LinkedInLead.campaign_id == campaign.id,
                        LinkedInLead.linkedin_url == url,
                    )
                )
                lead = existing.scalar_one_or_none()
                if lead:
                    # Update score if rescraped
                    lead.score = score
                    lead.engagement_count = len(eng_list)
                    lead.last_engagement_at = last_dt
                    lead.is_keyword_match = is_kw
                else:
                    lead = LinkedInLead(
                        campaign_id=campaign.id,
                        linkedin_url=url,
                        full_name=first.full_name,
                        headline=first.headline,
                        profile_picture_url=first.profile_picture_url,
                        score=score,
                        engagement_count=len(eng_list),
                        last_engagement_at=last_dt,
                        is_keyword_match=is_kw,
                    )
                    db.add(lead)
                    await db.flush()

                    # Persist individual engagements
                    for post_id, eng in info.get("pending_engagements", []):
                        db.add(LeadEngagement(
                            lead_id=lead.id,
                            post_id=post_id,
                            engagement_type=EngagementType(eng.engagement_type),
                            comment_text=eng.comment_text,
                            engaged_at=eng.engaged_at,
                        ))

                    saved_leads += 1

            campaign.status = CampaignStatus.completed
            campaign.completed_at = datetime.utcnow()
            campaign.leads_count = saved_leads
            campaign.posts_scraped = len(posts_data)
            await db.commit()
            log.info(
                "Campaign %s completed: %d posts, %d new leads",
                campaign_id, len(posts_data), saved_leads,
            )

        except Exception as exc:
            await db.rollback()
            campaign.status = CampaignStatus.failed
            campaign.error_message = str(exc)
            await db.commit()
            log.error("Campaign %s failed: %s", campaign_id, exc)
            raise
