# Investor Outreach Tracker

A personal dashboard for tracking investor outreach, accelerator applications, and fundraising conversations — auto-synced from Gmail and Google Calendar.

## Features

- **Auto-sync from Gmail & Calendar** — Scans your inbox and calendar for investor conversations, form submissions, rejections, and ongoing threads. Uses DeepSeek AI to classify items with high precision.
- **Thread clubbing** — Multiple conversations with the same investor are merged into one entry with a thread count and individual email links.
- **Bulk add targets** — Paste a list of investor/accelerator names (comma or newline separated) and they get added as ToDo entries with priority levels.
- **Smart classification** — Only captures: outreach you sent, form submission confirmations, rejections, and ongoing 1-to-1 conversations. Aggressively filters newsletters, announcements, and marketing.
- **Source tracking** — Each entry shows source icons (✏️ Manual, 📧 Email, 📅 Calendar, 📋 Form). Clubbed entries show all source types.
- **Priority tiers** — High, moderate, low priority tags for target investors.
- **Direct Gmail links** — Click to open the original email thread in Gmail.
- **Daily/weekly targets** — Track outreach goals with a 30-day bar chart.
- **Follow-up reminders** — Overdue and upcoming follow-ups highlighted.
- **Export/Import** — Backup and restore data as JSON.
- **Auto-sync every 24 hours** — Runs automatically on page load if last sync was >24h ago.

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **NextAuth v4** (Google OAuth with Gmail + Calendar scopes)
- **Google APIs** (Gmail API, Calendar API)
- **DeepSeek API** (AI classification of emails/events)
- **Vercel** (hosting, free tier)
- **localStorage** (client-side data persistence)

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Enable **Gmail API** and **Google Calendar API**
4. Set up OAuth consent screen (Internal for Google Workspace)
5. Go to **Data access** → add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
6. Create **OAuth Client ID** (Web Application):
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
DEEPSEEK_API_KEY=your-deepseek-key
```

### 3. Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with your Google Workspace account.

### 4. Deploy to Vercel

```bash
npx vercel
```

Add the same env vars in Vercel dashboard → Settings → Environment Variables. Then add `https://your-app.vercel.app/api/auth/callback/google` to your Google OAuth redirect URIs.

## Data Model

Each outreach entry tracks:
- Investor name & company
- Stage (angel, seed, series-a, accelerator)
- Status (todo, ongoing, holdoff, rejected)
- Source(s) (manual, email, calendar, form)
- Priority (high, moderate, low)
- Thread count & email links
- Outreach date, follow-up date, notes
