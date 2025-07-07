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

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run the bot:**
   ```bash
   python job_scraper.py
   ```

## Configuration

The bot can be configured through environment variables or by modifying `config.py`:

- `DISCORD_WEBHOOK_URL`: Discord webhook URL for notifications
- `GITHUB_URL`: GitHub repository URL to scrape
- `SCRAPE_INTERVAL`: How often to check for new jobs (minutes)
- `CACHE_FILE`: Location of cache file
- `LOG_FILE`: Location of log file

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
# In config.py, modify TABLE_SELECTORS
TABLE_SELECTORS = {
    "table": "table",  # CSS selector for the main table
    "header_rows_skip": 1,  # Number of header rows to skip
    "columns": {
        "company": 0,      # Column index for company name
        "role": 1,         # Column index for role/position
        "location": 2,     # Column index for location
        "link": 3,         # Column index for application link
        "date": 4          # Column index for date posted
    }
}
```

### Discord Embed Customization

Modify the `create_discord_embed()` method to customize the appearance of Discord notifications.

## Files

- `job_scraper.py`: Main application file
- `requirements.txt`: Python dependencies
- `.env.example`: Environment variable template
- `job_cache.json`: Cache file (created automatically)
- `job_scraper.log`: Log file (created automatically)

## Notes

- The bot needs to inspect the actual HTML structure of the target GitHub repository
- Table column indices may need adjustment based on the repository's table structure
- Rate limiting is implemented to avoid Discord webhook rate limits
- The bot maintains a cache to avoid duplicate notifications