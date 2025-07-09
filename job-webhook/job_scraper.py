#!/usr/bin/env python3
"""
Discord Job Scraper Bot
Scrapes job postings from GitHub repository and sends updates via Discord webhook
"""

import dataclasses
import hashlib
import json
import logging
import os
import time
from datetime import datetime
from typing import Optional
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

COMPANY_NAME_CONTINUATION = "\u21b3"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("job_scraper.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


@dataclasses.dataclass
class JobPosting:
    """Represents a job posting with all relevant information."""

    company: str
    role: str
    location: str
    application_link: str
    date_posted: str


@dataclasses.dataclass
class JobCache:
    """Represents cached job postings and content hash."""

    content_hash: str
    jobs: list[JobPosting]
    last_updated: datetime


@dataclasses.dataclass
class EmbedField:
    """Represents a field in a Discord embed."""

    name: str
    value: str
    inline: bool = False


@dataclasses.dataclass
class EmbedFooter:
    """Represents the footer of a Discord embed."""

    text: str
    icon_url: str | None = None


@dataclasses.dataclass
class DiscordEmbed:
    """Represents a Discord embed structure."""

    title: str
    description: str
    color: int
    fields: list[EmbedField]
    footer: EmbedFooter
    timestamp: str


class JobScraper:
    """Main class for scraping job postings and sending Discord notifications."""

    def __init__(
        self, webhook_url: str, github_url: str, cache_file: Path = Path("job_cache.json")
    ):
        """Initialize the job scraper with configuration."""
        self.webhook_url = webhook_url
        self.github_url = github_url
        self.cache_file = cache_file
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " "AppleWebKit/537.36"
                )
            }
        )

    def get_page_content(self) -> Optional[str]:
        """Fetch the HTML content from the GitHub repository."""
        try:
            response = self.session.get(self.github_url, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            logger.error(f"Error fetching page content: {e}")
            return None

    def get_content_hash(self, content: str) -> str:
        """Generate a hash of the content to detect changes."""
        return hashlib.md5(content.encode()).hexdigest()

    def load_cache(self) -> JobCache:
        """Load cached data from file."""
        # Check if cache file exists and is not empty
        if not self.cache_file.exists() or self.cache_file.stat().st_size == 0:
            logger.info("Cache file not found or empty, returning empty cache")
            return JobCache(
                content_hash="",
                jobs=[],
                last_updated=datetime.now(),
            )
        
        try:
            with self.cache_file.open(encoding="utf-8") as f:
                temp = json.load(f)
            return JobCache(
                content_hash=temp["content_hash"],
                jobs=[
                    JobPosting(**job) for job in temp["jobs"]
                ],
                last_updated=temp["last_updated"],
            )
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning(f"Invalid cache file format, starting fresh: {e}")
            return JobCache(
                content_hash="",
                jobs=[],
                last_updated=datetime.now(),
            )
        
    def save_cache(self, content_hash: str, jobs: list[JobPosting]) -> None:
        """Save current state to cache file."""
        cache_data = {
            "content_hash": content_hash,
            "jobs": [dataclasses.asdict(job) for job in jobs],
            "last_updated": datetime.now().isoformat(),
        }
        try:
            with self.cache_file.open("w", encoding="utf-8") as f:
                json.dump(cache_data, f, indent=2)
            logger.info(f"Cache saved with {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"Error saving cache: {e}")

    def parse_job_table(self, html_content: str) -> list[JobPosting]:
        """Parse the HTML content and extract job postings from table."""
        soup = BeautifulSoup(html_content, "html.parser")
        jobs: list[JobPosting] = []

        # Find the second table in the HTML content
        # Adjust the index if the structure changes
        tables = soup.find_all("table")
        if len(tables) < 2:
            logger.warning("No table found in HTML content")
            return jobs

        table = tables[1]

        # Skip header row
        rows = table.find_all("tr")[1:]
        last_company = ""

        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) >= 4:  # Adjust based on actual table structure
                try:
                    # Extract job information - adjust indices based on actual table structure
                    company = cells[0].get_text(strip=True)
                    if company == COMPANY_NAME_CONTINUATION:
                        company = last_company
                    else:
                        last_company = company

                    role = cells[1].get_text(strip=True)
                    location = cells[2].get_text(strip=True)

                    # Extract application link
                    link_cell = cells[3]
                    link_element = link_cell.find("a")
                    application_link = (
                        link_element["href"] if link_element else "No link available"
                    )

                    # Extract date (might be in a different column)
                    date_posted = (
                        cells[4].get_text(strip=True)
                        if len(cells) > 4
                        else "Not specified"
                    )

                    # Skip empty rows
                    if not company or not role:
                        continue

                    job = JobPosting(
                        company=company,
                        role=role,
                        location=location,
                        application_link=application_link,
                        date_posted=date_posted,
                    )
                    jobs.append(job)

                except Exception as e:
                    logger.warning(f"Error parsing job row: {e}")
                    continue

        jobs.reverse()
        logger.info(f"Parsed {len(jobs)} job postings")
        return jobs

    def find_new_jobs(
        self, current_jobs: list[JobPosting], cached_jobs: list[JobPosting]
    ) -> list[JobPosting]:
        """Compare current jobs with cached jobs to find new postings."""
        cached_job_signatures = set()

        for job in cached_jobs:
            # Create a unique signature for each job
            signature = (
                f"{job.company}-{job.role}-"
                f"{job.location}"
            )
            cached_job_signatures.add(signature)

        new_jobs = []
        for job in current_jobs:
            signature = f"{job.company}-{job.role}-{job.location}"
            if signature not in cached_job_signatures:
                new_jobs.append(job)

        return new_jobs

    def create_discord_embed(self, job: JobPosting) -> DiscordEmbed:
        """Create a Discord embed for a job posting."""
        # Create application link text
        if job.application_link.startswith("http"):
            link_text = f"[Apply Here]({job.application_link})"
        else:
            link_text = job.application_link

        fields = [
            EmbedField(name="🏢 Company", value=job.company, inline=True),
            EmbedField(name="💼 Role", value=job.role, inline=True),
            EmbedField(name="📍 Location", value=job.location, inline=True),
            EmbedField(name="🔗 Application Link", value=link_text, inline=False),
            EmbedField(name="📅 Date Posted", value=job.date_posted, inline=True),
        ]

        footer = EmbedFooter(
            text="Job Scraper Bot • Summer 2026 Internships",
            icon_url=(
                "https://github.githubassets.com/images/modules/"
                "logos_page/GitHub-Mark.png"
            ),
        )

        embed = DiscordEmbed(
            title=f"🎯 New Job Posting: {job.role}",
            description=(
                f"**{job.company}** has posted a new " "internship opportunity!"
            ),
            color=0x00FF00,  # Green color
            fields=fields,
            footer=footer,
            timestamp=datetime.now().isoformat(),
        )
        return embed

    def send_discord_notification(self, job: JobPosting) -> bool:
        """Send a Discord notification for a new job posting."""
        try:
            embed = self.create_discord_embed(job)
            payload = {
                "username": "Job Alert Bot",
                "avatar_url": (
                    "https://github.githubassets.com/images/modules/"
                    "logos_page/GitHub-Mark.png"
                ),
                "embeds": [dataclasses.asdict(embed)],
            }

            response = self.session.post(self.webhook_url, json=payload, timeout=10)
            response.raise_for_status()

            logger.info(
                f"Successfully sent notification for {job.company} - " f"{job.role}"
            )
            return True

        except requests.RequestException as e:
            logger.error(f"Error sending Discord notification: {e}")
            return False

    def run_once(self) -> None:
        """Run a single scraping cycle."""
        logger.info("Starting job scraping cycle...")

        # Get current page content
        html_content = self.get_page_content()
        if not html_content:
            logger.error("Failed to fetch page content")
            return

        # Check if content has changed
        current_hash = self.get_content_hash(html_content)
        cache = self.load_cache()

        if current_hash == cache.content_hash:
            logger.info("No changes detected in page content")
            return

        # Parse current jobs
        current_jobs = self.parse_job_table(html_content)
        if not current_jobs:
            logger.warning("No jobs found in current scrape")
            return

        # Find new jobs
        new_jobs = self.find_new_jobs(current_jobs, cache.jobs)

        if new_jobs:
            logger.info(f"Found {len(new_jobs)} new job postings")

            # Send notifications for new jobs
            for job in new_jobs:
                success = self.send_discord_notification(job)
                if success:
                    time.sleep(2)  # Rate limit: wait 2 seconds between messages
                else:
                    logger.warning(
                        f"Failed to send notification for "
                        f"{job.company} - {job.role}"
                    )
        else:
            logger.info("No new jobs found")

        # Update cache
        self.save_cache(current_hash, current_jobs)
        logger.info("Scraping cycle completed")

    def run_continuously(self, interval_minutes: int = 15) -> None:
        """Run the scraper continuously with specified interval."""
        logger.info(
            f"Starting continuous job scraping every " f"{interval_minutes} minutes"
        )

        while True:
            try:
                self.run_once()
                logger.info(f"Sleeping for {interval_minutes} minutes...")
                time.sleep(interval_minutes * 60)

            except KeyboardInterrupt:
                logger.info("Scraper stopped by user")
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                logger.info("Continuing after error...")
                time.sleep(60)  # Wait 1 minute before retrying


def main() -> None:
    """Main function to run the job scraper."""
    # Configuration from environment variables
    load_dotenv()
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    github_url = os.getenv(
        "GITHUB_URL", "https://github.com/vanshb03/Summer2026-Internships"
    )
    scrape_interval_minutes = int(os.getenv("SCRAPE_INTERVAL", "15"))

    if not webhook_url:
        logger.error("DISCORD_WEBHOOK_URL environment variable is required")
        return

    scraper = JobScraper(webhook_url, github_url)

    # Run once for testing
    # scraper.run_once()

    # Run continuously
    scraper.run_continuously(scrape_interval_minutes)


if __name__ == "__main__":
    main()
