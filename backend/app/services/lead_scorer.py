"""
Lead scoring algorithm.

Score breakdown:
  - Comment on a post      : +30 pts
  - Like on a post         : +10 pts
  - Multi-post engagement  : +20 pts bonus (engaged on ≥2 posts)
  - Activity < 7 days ago  : +20 pts
  - Activity < 30 days ago : +10 pts
  - Keyword match in title : +15 pts
"""
from datetime import datetime, timezone
from typing import Optional
from app.services.linkedin_scraper import EngagementData


def compute_score(
    engagements: list[EngagementData],
    target_keywords: list[str],
    headline: Optional[str],
) -> tuple[int, bool]:
    """
    Returns (score, is_keyword_match).
    """
    score = 0
    is_keyword_match = False

    # Engagement score
    likes = [e for e in engagements if e.engagement_type == "like"]
    comments = [e for e in engagements if e.engagement_type == "comment"]

    score += len(comments) * 30
    score += len(likes) * 10

    # Multi-post bonus
    unique_posts = {id(e) for e in engagements}  # each engagement = 1 post interaction
    if len(engagements) >= 2:
        score += 20

    # Recency bonus (use the most recent engagement)
    most_recent = _most_recent_date(engagements)
    if most_recent:
        now = datetime.utcnow()
        delta_days = (now - most_recent).days
        if delta_days < 7:
            score += 20
        elif delta_days < 30:
            score += 10

    # Keyword match in headline / job title
    if target_keywords and headline:
        headline_lower = headline.lower()
        for kw in target_keywords:
            if kw.lower() in headline_lower:
                is_keyword_match = True
                score += 15
                break

    return score, is_keyword_match


def _most_recent_date(engagements: list[EngagementData]) -> Optional[datetime]:
    dates = [e.engaged_at for e in engagements if e.engaged_at]
    return max(dates) if dates else None


def classify_lead(score: int) -> str:
    """Return 'hot' | 'warm' | 'cold' based on score."""
    if score >= 50:
        return "hot"
    if score >= 20:
        return "warm"
    return "cold"
