# Discord Job Scraper Bot

A Python bot that scrapes job postings from a GitHub repository and sends notifications to Discord via webhook.

## Features

- Scrapes job postings from GitHub repositories (specifically Summer 2026 internships)
- Caches content to detect new postings
- Sends formatted Discord notifications for new jobs
- Configurable scraping intervals
- Rate limiting to avoid spam
- Comprehensive logging

## Setup

1. **Install dependencies and activate virtual environment:**
   ```bash
   cd job-webhook
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   ```bash
   # Edit .env to contain the environment variable
   DISCORD_WEBHOOK_URL=[INSERT WEBHOOK URL HERE]
   # Optional Variables
   GITHUB_URL=[URL OF GITHUB JOB POSTINGS]
   SCRAPE_INTERVAL=[SCRAPE INTERVAL IN MINUTES]
   ```

3. **Run the bot:**
   ```bash
   python job_scraper.py
   ```

## Configuration

The bot can be configured through environment variables:

- `DISCORD_WEBHOOK_URL`: Discord webhook URL for notifications
- `GITHUB_URL`: GitHub repository URL to scrape
- `SCRAPE_INTERVAL`: How often to check for new jobs (minutes)

## Usage

### Run Once (for testing)
```python
scraper = JobScraper(WEBHOOK_URL, GITHUB_URL)
scraper.run_once()
```

### Run Continuously
```python
scraper = JobScraper(WEBHOOK_URL, GITHUB_URL)
scraper.run_continuously(interval_minutes=15)
```

## Customization

### Adjusting Table Parsing

The bot uses BeautifulSoup to parse HTML tables. You may need to adjust the parsing logic in `parse_job_table()` method based on the actual HTML structure:

```python
company = cells[0].get_text(strip=True)
if company == MAGIC_LITERAL:
   company = last_company
else:
   last_company = company
role = cells[1].get_text(strip=True)
location = cells[2].get_text(strip=True)  
# Extract application link
link_cell = cells[3]
```

### Discord Embed Customization

Modify the `create_discord_embed()` method to customize the appearance of Discord notifications.

## Files

- `job_scraper.py`: Main application file
- `requirements.txt`: Python dependencies
- `job_cache.json`: Cache file (created automatically)
- `job_scraper.log`: Log file (created automatically)

## Notes

- The bot needs to inspect the actual HTML structure of the target GitHub repository
- Table column indices may need adjustment based on the repository's table structure
- Rate limiting is implemented to avoid Discord webhook rate limits
- The bot maintains a cache to avoid duplicate notifications