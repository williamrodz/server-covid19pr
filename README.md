# COVID-19 Puerto Rico Tracker

A Firebase Cloud Functions-based system that automatically scrapes, stores, and disseminates COVID-19 statistics for Puerto Rico. The system monitors the Puerto Rico Department of Health website multiple times daily and distributes updates via Twitter, SMS, and a public API.

## Architecture Overview

```
                           +---------------------------+
                           |   PR Department of Health |
                           |  covid19datos.salud.gov.pr|
                           +-------------+-------------+
                                         |
                                         | Puppeteer Scraping
                                         v
+------------------------+     +-------------------+     +---------------------+
|  Scheduled Functions   |---->| Firebase Cloud    |---->| Google Firestore    |
|  (6x daily)            |     | Functions         |     | Database            |
|  8AM, 9AM, 12:30PM,    |     | (index.js)        |     |                     |
|  5PM, 9PM, 11:59PM     |     +-------------------+     | - todaysData        |
+------------------------+              |                | - historicalData    |
                                        |                | - vaccineHistory    |
                                        |                | - users (API keys)  |
                                        v                +----------+----------+
                          +-------------+-------------+             |
                          |                           |             |
              +-----------v-----------+   +-----------v-----------+ |
              |    Twitter API        |   |    Twilio SMS         | |
              |    @covid19puertorico |   |    Notifications      | |
              +-----------------------+   +-----------------------+ |
                                                                    |
                                        +---------------------------v--+
                                        |       Public REST API        |
                                        |  getTodaysData()             |
                                        |  getHistoricalData()         |
                                        +------------------------------+
```

## Project Structure

```
server_covid19pr/
├── functions/
│   ├── index.js            # Main application (~990 lines)
│   ├── package.json        # Dependencies (Node.js 10)
│   ├── privateKey.json     # Credentials (gitignored)
│   └── .eslintrc.json      # Linting rules
├── Data_Backup/            # Historical CSV exports (June 2020 - April 2021)
├── firebase.json           # Firebase project config
└── .firebaserc             # Firebase project ID
```

## Core Components

### 1. Data Scraping (`scrapeTodaysData`, `scrapeVaccineData`)

Uses Puppeteer for headless browser automation to extract:
- **Molecular positive cases** - PCR test confirmations
- **Antigen positive cases** - Rapid test confirmations
- **Deaths** - Confirmed COVID-related deaths
- **Vaccination data** - Doses administered, population coverage

The scraper validates data freshness before storing to prevent duplicates.

### 2. Data Storage (Firestore)

| Collection | Purpose |
|------------|---------|
| `data/todaysData` | Current day's statistics |
| `data/historicalData` | Array of all historical records |
| `data/vaccineHistory` | Vaccination progress over time |
| `data/vaccinesToday` | Current vaccination numbers |
| `users/{apiKey}` | API consumer tracking & rate limiting |

### 3. Dissemination Channels

| Channel | Function | Description |
|---------|----------|-------------|
| Twitter | `tweetDailyInfo()` | Daily case summaries with progress bars |
| Twitter | `tweetVaccineMessage()` | Vaccination progress updates |
| SMS | `sendAllSMS()` | Twilio-powered text notifications |
| API | `getTodaysData()` | REST endpoint for current data |
| API | `getHistoricalData()` | REST endpoint for historical data |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCRAPING PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Scheduled Trigger ──> Launch Puppeteer ──> Navigate to PR Health Site  │
│         │                                                               │
│         v                                                               │
│  Extract DOM Elements ──> Parse Numbers ──> Validate Freshness          │
│         │                                          │                    │
│         │                              ┌───────────┴───────────┐        │
│         │                              │  Data Newer?          │        │
│         │                              │  Yes         No       │        │
│         │                              │   │          │        │        │
│         v                              │   v          v        │        │
│  Store in Firestore <──────────────────┘ Save      Skip        │        │
│         │                                                               │
│         v                                                               │
│  Append to Historical Array ──> Trigger Tweet ──> Send SMS             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Schedule

The system runs at these times daily (America/La_Paz timezone):

| Time | Scrape Cases | Scrape Vaccines | Tweet |
|------|--------------|-----------------|-------|
| 8:00 AM | Yes | Yes | No |
| 9:00 AM | Yes | Yes | Yes |
| 12:30 PM | Yes | Yes | Yes |
| 5:00 PM | Yes | Yes | Yes |
| 9:00 PM | Yes | Yes | Yes |
| 11:59 PM | Yes | Yes | Yes |

## Public API

### Authentication

All API calls require a valid API key passed as a query parameter. Each key is limited to 1,000 calls.

### Endpoints

#### Get Today's Data
```
GET /getTodaysData?key={API_KEY}
```

Response:
```json
{
  "molecularPositive": 150234,
  "antigenPositive": 89456,
  "totalPositive": 239690,
  "deaths": 2891,
  "saludTimeSignature": "7/24/2026 2:30 PM"
}
```

#### Get Historical Data
```
GET /getHistoricalData?key={API_KEY}&stats=totalPositive,deaths
```

The `stats` parameter filters which fields to return.

### Error Responses

| Code | Meaning |
|------|---------|
| `INVALID_API_KEY` | API key not found in database |
| `NUMBER_OF_CALLS_EXCEEDED` | Rate limit (1,000 calls) reached |

## Tweet Format

The system generates formatted tweets with visual progress bars:

```
COVID-19 Puerto Rico
7/24/2026

Casos Totales: 239,690 (+1,234)
  Molecular: 150,234 (+789)
  Antígeno: 89,456 (+445)

Muertes: 2,891 (+3)

Vacunación (≥1 dosis):
████████░░|░░ 78.5% (+0.12%)
```

Progress bar breakdown:
- `█` = 10% increments filled
- `░` = 10% increments remaining
- `|` = 70% herd immunity marker

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| puppeteer | 8.0.0 | Headless browser for scraping |
| firebase-functions | 3.3.0 | Cloud Functions runtime |
| firebase-admin | 8.9.0 | Firestore database access |
| twitter | 1.7.1 | Twitter API client |
| twilio | 3.43.0 | SMS messaging |
| node-fetch | 2.6.0 | HTTP requests |
| bluebird | 3.7.2 | Promise utilities |

## Configuration

### Required Credentials (`functions/privateKey.json`)

```json
{
  "type": "service_account",
  "project_id": "covid19puertorico-1a743",

  "twitter_consumer_key": "...",
  "twitter_consumer_secret": "...",
  "twitter_access_token_key": "...",
  "twitter_access_token_secret": "...",

  "twilio_sid": "...",
  "twilio_token": "...",
  "twilio_numbers": ["+1234567890"],

  "facebook_access_token": "..."
}
```

### Firebase Project

- **Project ID:** `covid19puertorico-1a743`
- **Region:** us-central1
- **Database URL:** `https://covid19puertorico-1a743.firebaseio.com`

## Deployment

```bash
cd functions
npm install
npm run deploy
```

The deploy script runs ESLint before deployment to catch errors.

## Local Development

Start the Firebase emulator:

```bash
firebase emulators:start
```

Test endpoint locally:
```
http://localhost:5001/covid19puertorico-1a743/us-central1/getTodaysData?key=test
```

## Cloud Function Configuration

Functions that perform scraping are configured with:
- **Memory:** 2GB (required for Puppeteer)
- **Timeout:** 120 seconds

## Key Implementation Details

### Freshness Validation

Before storing scraped data, the system checks:
1. Is the timestamp newer than the last stored timestamp?
2. Have the actual values changed (not just cosmetic timestamp updates)?

This prevents duplicate entries and unnecessary tweets.

### Tweet Deduplication

The system tracks `dayOfTweet` in Firestore to ensure only one tweet per day per data type, even if the scraper runs multiple times.

### Population Constant

Vaccination percentages are calculated against Puerto Rico's population:
```javascript
const PUERTO_RICO_POPULATION = 3076212;
```

## Historical Data

The `Data_Backup/` directory contains CSV exports from the pandemic's early tracking period (June 2020 - April 2021), useful for analysis or recovery.

## License

Private project - not for redistribution.
