"""
LinkedIn scraper via ProxyCurl (primary) with Apify fallback.

ProxyCurl docs: https://nubela.co/proxycurl/docs
Apify LinkedIn actors: linkedin-post-scraper, linkedin-profile-scraper
"""
import httpx
import logging
from datetime import datetime
from typing import Optional
from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

PROXYCURL_BASE = "https://nubela.co/proxycurl/api"
APIFY_BASE = "https://api.apify.com/v2"


class ScrapedPostData:
    def __init__(
        self,
        post_urn: Optional[str],
        post_url: Optional[str],
        post_text: Optional[str],
        posted_at: Optional[datetime],
        likes_count: int,
        comments_count: int,
    ):
        self.post_urn = post_urn
        self.post_url = post_url
        self.post_text = post_text
        self.posted_at = posted_at
        self.likes_count = likes_count
        self.comments_count = comments_count


class EngagementData:
    def __init__(
        self,
        linkedin_url: str,
        full_name: Optional[str],
        headline: Optional[str],
        profile_picture_url: Optional[str],
        engagement_type: str,
        comment_text: Optional[str],
        engaged_at: Optional[datetime],
    ):
        self.linkedin_url = linkedin_url
        self.full_name = full_name
        self.headline = headline
        self.profile_picture_url = profile_picture_url
        self.engagement_type = engagement_type  # "like" | "comment"
        self.comment_text = comment_text
        self.engaged_at = engaged_at


class LinkedInScraper:
    def __init__(self):
        self._proxycurl_key = settings.PROXYCURL_API_KEY
        self._apify_token = settings.APIFY_API_TOKEN
        self._provider = settings.LINKEDIN_SCRAPER_PROVIDER  # "proxycurl" | "apify"

    # ── Public interface ───────────────────────────────────────────────────────

    async def get_company_posts(
        self, company_linkedin_url: str, max_posts: int = 10
    ) -> list[ScrapedPostData]:
        if self._provider == "apify":
            return await self._apify_company_posts(company_linkedin_url, max_posts)
        return await self._proxycurl_company_posts(company_linkedin_url, max_posts)

    async def get_post_engagements(
        self, post_urn: str, post_url: Optional[str] = None
    ) -> list[EngagementData]:
        if self._provider == "apify":
            return await self._apify_post_engagements(post_urn, post_url)
        return await self._proxycurl_post_engagements(post_urn)

    # ── ProxyCurl ──────────────────────────────────────────────────────────────

    async def _proxycurl_company_posts(
        self, company_url: str, max_posts: int
    ) -> list[ScrapedPostData]:
        headers = {"Authorization": f"Bearer {self._proxycurl_key}"}
        params = {
            "linkedin_company_profile_url": company_url,
            "type": "posts",
            "pagination_token": None,
        }
        posts: list[ScrapedPostData] = []
        async with httpx.AsyncClient(timeout=30) as client:
            while len(posts) < max_posts:
                resp = await client.get(
                    f"{PROXYCURL_BASE}/linkedin/company/posts",
                    headers=headers,
                    params={k: v for k, v in params.items() if v is not None},
                )
                resp.raise_for_status()
                data = resp.json()

                for item in data.get("posts", []):
                    if len(posts) >= max_posts:
                        break
                    posts.append(ScrapedPostData(
                        post_urn=item.get("urn"),
                        post_url=item.get("post_url"),
                        post_text=item.get("text"),
                        posted_at=_parse_ts(item.get("time")),
                        likes_count=item.get("num_likes", 0) or 0,
                        comments_count=item.get("num_comments", 0) or 0,
                    ))

                next_token = data.get("next_page")
                if not next_token:
                    break
                params["pagination_token"] = next_token

        return posts

    async def _proxycurl_post_engagements(
        self, post_urn: str
    ) -> list[EngagementData]:
        headers = {"Authorization": f"Bearer {self._proxycurl_key}"}
        engagements: list[EngagementData] = []

        async with httpx.AsyncClient(timeout=30) as client:
            # Likers
            resp = await client.get(
                f"{PROXYCURL_BASE}/linkedin/post/likers",
                headers=headers,
                params={"linkedin_post_urn": post_urn},
            )
            if resp.status_code == 200:
                for liker in resp.json().get("likers", []):
                    engagements.append(EngagementData(
                        linkedin_url=liker.get("linkedin_profile_url", ""),
                        full_name=liker.get("name"),
                        headline=liker.get("title"),
                        profile_picture_url=liker.get("profile_pic_url"),
                        engagement_type="like",
                        comment_text=None,
                        engaged_at=None,
                    ))

            # Comments
            resp = await client.get(
                f"{PROXYCURL_BASE}/linkedin/post/comments",
                headers=headers,
                params={"linkedin_post_urn": post_urn},
            )
            if resp.status_code == 200:
                for comment in resp.json().get("comments", []):
                    commenter = comment.get("commenter", {})
                    engagements.append(EngagementData(
                        linkedin_url=commenter.get("linkedin_profile_url", ""),
                        full_name=commenter.get("name"),
                        headline=commenter.get("title"),
                        profile_picture_url=commenter.get("profile_pic_url"),
                        engagement_type="comment",
                        comment_text=comment.get("comment"),
                        engaged_at=_parse_ts(comment.get("created_time")),
                    ))

        return engagements

    # ── Apify ──────────────────────────────────────────────────────────────────

    async def _apify_company_posts(
        self, company_url: str, max_posts: int
    ) -> list[ScrapedPostData]:
        """
        Uses Apify actor: apify/linkedin-post-scraper
        Starts a run and polls until finished, then reads the dataset.
        """
        async with httpx.AsyncClient(timeout=120) as client:
            # Start run
            run_resp = await client.post(
                f"{APIFY_BASE}/acts/apify~linkedin-post-scraper/runs",
                params={"token": self._apify_token},
                json={
                    "startUrls": [{"url": company_url}],
                    "maxPosts": max_posts,
                },
            )
            run_resp.raise_for_status()
            run_id = run_resp.json()["data"]["id"]

            # Poll for completion (max 5 min)
            import asyncio
            for _ in range(30):
                await asyncio.sleep(10)
                status_resp = await client.get(
                    f"{APIFY_BASE}/actor-runs/{run_id}",
                    params={"token": self._apify_token},
                )
                status = status_resp.json()["data"]["status"]
                if status in ("SUCCEEDED", "FAILED", "ABORTED"):
                    break

            if status != "SUCCEEDED":
                raise RuntimeError(f"Apify run {run_id} ended with status {status}")

            # Fetch dataset
            dataset_id = status_resp.json()["data"]["defaultDatasetId"]
            items_resp = await client.get(
                f"{APIFY_BASE}/datasets/{dataset_id}/items",
                params={"token": self._apify_token, "limit": max_posts},
            )
            items_resp.raise_for_status()

        posts: list[ScrapedPostData] = []
        for item in items_resp.json():
            posts.append(ScrapedPostData(
                post_urn=item.get("id") or item.get("urn"),
                post_url=item.get("url") or item.get("postUrl"),
                post_text=item.get("text") or item.get("content"),
                posted_at=_parse_ts(item.get("postedAt") or item.get("date")),
                likes_count=item.get("likesCount", 0) or 0,
                comments_count=item.get("commentsCount", 0) or 0,
            ))
        return posts

    async def _apify_post_engagements(
        self, post_urn: str, post_url: Optional[str]
    ) -> list[EngagementData]:
        """
        Uses Apify actor: apify/linkedin-reactions-scraper
        """
        target_url = post_url or f"https://www.linkedin.com/feed/update/{post_urn}/"
        async with httpx.AsyncClient(timeout=120) as client:
            run_resp = await client.post(
                f"{APIFY_BASE}/acts/apify~linkedin-reactions-scraper/runs",
                params={"token": self._apify_token},
                json={"postUrls": [target_url]},
            )
            run_resp.raise_for_status()
            run_id = run_resp.json()["data"]["id"]

            import asyncio
            for _ in range(30):
                await asyncio.sleep(10)
                status_resp = await client.get(
                    f"{APIFY_BASE}/actor-runs/{run_id}",
                    params={"token": self._apify_token},
                )
                status = status_resp.json()["data"]["status"]
                if status in ("SUCCEEDED", "FAILED", "ABORTED"):
                    break

            if status != "SUCCEEDED":
                raise RuntimeError(f"Apify run {run_id} ended with status {status}")

            dataset_id = status_resp.json()["data"]["defaultDatasetId"]
            items_resp = await client.get(
                f"{APIFY_BASE}/datasets/{dataset_id}/items",
                params={"token": self._apify_token},
            )
            items_resp.raise_for_status()

        engagements: list[EngagementData] = []
        for item in items_resp.json():
            engagements.append(EngagementData(
                linkedin_url=item.get("profileUrl") or item.get("linkedinUrl", ""),
                full_name=item.get("name") or item.get("fullName"),
                headline=item.get("headline") or item.get("title"),
                profile_picture_url=item.get("profilePicture") or item.get("photoUrl"),
                engagement_type=item.get("reactionType", "like").lower() if item.get("reactionType") != "COMMENT" else "comment",
                comment_text=item.get("text") if item.get("type") == "comment" else None,
                engaged_at=_parse_ts(item.get("date") or item.get("timestamp")),
            ))
        return engagements


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_ts(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.utcfromtimestamp(value)
        except Exception:
            return None
    if isinstance(value, str):
        for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
    return None
