#!/usr/bin/env python3
"""
Discord Job Scraper Bot
Scrapes job postings from GitHub repository and sends updates via Discord webhook
"""

import requests
import json
import time
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Set
from bs4 import BeautifulSoup
import logging
import os
from dataclasses import dataclass
from dotenv import load_dotenv
load_dotenv()
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('job_scraper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class JobPosting:
    """Represents a job posting with all relevant information"""
    company: str
    role: str
    location: str
    application_link: str
    date_posted: str
    
    def to_dict(self) -> Dict:
        return {
            'company': self.company,
            'role': self.role,
            'location': self.location,
            'application_link': self.application_link,
            'date_posted': self.date_posted
        }

class JobScraper:
    """Main class for scraping job postings and sending Discord notifications"""
    
    def __init__(self, webhook_url: str, github_url: str, cache_file: str = "job_cache.json"):
        self.webhook_url = webhook_url
        self.github_url = github_url
        self.cache_file = cache_file
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
    def get_page_content(self) -> Optional[str]:
        """Fetch the HTML content from the GitHub repository"""
        try:
            response = self.session.get(self.github_url, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            logger.error(f"Error fetching page content: {e}")
            return None
    
    def get_content_hash(self, content: str) -> str:
        """Generate a hash of the content to detect changes"""
        return hashlib.md5(content.encode()).hexdigest()
    
    def load_cache(self) -> Dict:
        """Load cached data from file"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                logger.warning("Cache file corrupted or not found, starting fresh")
        return {"content_hash": "", "jobs": []}
    
    def save_cache(self, content_hash: str, jobs: List[JobPosting]):
        """Save current state to cache file"""
        cache_data = {
            "content_hash": content_hash,
            "jobs": [job.to_dict() for job in jobs],
            "last_updated": datetime.now().isoformat()
        }
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(cache_data, f, indent=2)
            logger.info(f"Cache saved with {len(jobs)} jobs")
        except Exception as e:
            logger.error(f"Error saving cache: {e}")
    
    def parse_job_table(self, html_content: str) -> List[JobPosting]:
        """Parse the HTML content and extract job postings from table"""
        soup = BeautifulSoup(html_content, 'html.parser')
        jobs = []
        
        # Find the main table - adjust selector based on actual HTML structure
        # This is a template - you'll need to inspect the actual HTML structure
        table = soup.find_all('table')[1]
        if not table:
            logger.warning("No table found in HTML content")
            return jobs
        
        # Skip header row
        rows = table.find_all('tr')[1:]
        last_company = ""
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) >= 4:  # Adjust based on actual table structure
                try:
                    # Extract job information - adjust indices based on actual table structure
                    company = cells[0].get_text(strip=True)
                    if company == "\u21b3":
                        company = last_company
                    else:
                        last_company = company
                    role = cells[1].get_text(strip=True)
                    location = cells[2].get_text(strip=True)
                    
                    # Extract application link
                    link_cell = cells[3]
                    link_element = link_cell.find('a')
                    application_link = link_element['href'] if link_element else "No link available"
                    
                    # Extract date (might be in a different column)
                    date_posted = cells[4].get_text(strip=True) if len(cells) > 4 else "Not specified"
                    
                    # Skip empty rows
                    if not company or not role:
                        continue
                    
                    job = JobPosting(
                        company=company,
                        role=role,
                        location=location,
                        application_link=application_link,
                        date_posted=date_posted
                    )
                    jobs.append(job)
                    
                except Exception as e:
                    logger.warning(f"Error parsing job row: {e}")
                    continue
        jobs.reverse()
        logger.info(f"Parsed {len(jobs)} job postings")
        return jobs
    
    def find_new_jobs(self, current_jobs: List[JobPosting], cached_jobs: List[Dict]) -> List[JobPosting]:
        """Compare current jobs with cached jobs to find new postings"""
        cached_job_signatures = set()
        
        for job in cached_jobs:
            # Create a unique signature for each job
            signature = f"{job.get('company', '')}-{job.get('role', '')}-{job.get('location', '')}"
            cached_job_signatures.add(signature)
        
        new_jobs = []
        for job in current_jobs:
            signature = f"{job.company}-{job.role}-{job.location}"
            if signature not in cached_job_signatures:
                new_jobs.append(job)
        
        return new_jobs
    
    def create_discord_embed(self, job: JobPosting) -> Dict:
        """Create a Discord embed for a job posting"""
        embed = {
            "title": f"🎯 New Job Posting: {job.role}",
            "description": f"**{job.company}** has posted a new internship opportunity!",
            "color": 0x00ff00,  # Green color
            "fields": [
                {
                    "name": "🏢 Company",
                    "value": job.company,
                    "inline": True
                },
                {
                    "name": "💼 Role",
                    "value": job.role,
                    "inline": True
                },
                {
                    "name": "📍 Location",
                    "value": job.location,
                    "inline": True
                },
                {
                    "name": "🔗 Application Link",
                    "value": f"[Apply Here]({job.application_link})" if job.application_link.startswith('http') else job.application_link,
                    "inline": False
                },
                {
                    "name": "📅 Date Posted",
                    "value": job.date_posted,
                    "inline": True
                }
            ],
            "footer": {
                "text": "Job Scraper Bot • Summer 2026 Internships",
                "icon_url": "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
            },
            "timestamp": datetime.now().isoformat()
        }
        return embed
    
    def send_discord_notification(self, job: JobPosting) -> bool:
        """Send a Discord notification for a new job posting"""
        try:
            embed = self.create_discord_embed(job)
            payload = {
                "username": "Job Alert Bot",
                "avatar_url": "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
                "embeds": [embed]
            }
            
            response = self.session.post(
                self.webhook_url,
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            
            logger.info(f"Successfully sent notification for {job.company} - {job.role}")
            return True
            
        except requests.RequestException as e:
            logger.error(f"Error sending Discord notification: {e}")
            return False
    
    def run_once(self):
        """Run a single scraping cycle"""
        logger.info("Starting job scraping cycle...")
        
        # Get current page content
        html_content = self.get_page_content()
        if not html_content:
            logger.error("Failed to fetch page content")
            return
        
        # Check if content has changed
        current_hash = self.get_content_hash(html_content)
        cache = self.load_cache()
        
        if current_hash == cache.get("content_hash"):
            logger.info("No changes detected in page content")
            return
        
        # Parse current jobs
        current_jobs = self.parse_job_table(html_content)
        if not current_jobs:
            logger.warning("No jobs found in current scrape")
            return
        
        # Find new jobs
        new_jobs = self.find_new_jobs(current_jobs, cache.get("jobs", []))
        
        if new_jobs:
            logger.info(f"Found {len(new_jobs)} new job postings")
            
            # Send notifications for new jobs
            for job in new_jobs:
                success = self.send_discord_notification(job)
                if success:
                    time.sleep(2)  # Rate limit: wait 2 seconds between messages
                else:
                    logger.warning(f"Failed to send notification for {job.company} - {job.role}")
        else:
            logger.info("No new jobs found")
        
        # Update cache
        self.save_cache(current_hash, current_jobs)
        logger.info("Scraping cycle completed")
    
    def run_continuously(self, interval_minutes: int = 15):
        """Run the scraper continuously with specified interval"""
        logger.info(f"Starting continuous job scraping every {interval_minutes} minutes")
        
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

def main():
    """Main function to run the job scraper"""
    # Configuration from environment variables
      # Load environment variables from .env file if exists
    WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
    GITHUB_URL = os.getenv("GITHUB_URL", "https://github.com/vanshb03/Summer2026-Internships")
    SCRAPE_INTERVAL = int(os.getenv("SCRAPE_INTERVAL", "15"))  # minutes
    
    # Validate required environment variables
    if not WEBHOOK_URL:
        logger.error("DISCORD_WEBHOOK_URL environment variable is required")
        return
    
    # Create and run scraper
    scraper = JobScraper(WEBHOOK_URL, GITHUB_URL)
    
    # Run once for testing
    # scraper.run_once()
    
    # Run continuously
    scraper.run_continuously(SCRAPE_INTERVAL)

if __name__ == "__main__":
    main()