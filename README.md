# Cascadia License Check

An internal web application for nurse and CNA license verification with monthly automated checks, manual verification workflows, CSV import, and audit logging.

## Features

- **Dashboard** - Overview of license statuses, upcoming expirations, and pending tasks
- **People Management** - CRUD operations for nurses and CNAs
- **License Management** - Track licenses with status, expiration, and verification history
- **Verification Tasks** - Manual verification queue with source links and completion workflow
- **CSV Import** - Bulk import licenses with validation and preview
- **Verification Sources** - Manage BON lookups, CNA registries, and Nursys e-Notify
- **OCR Support** - Extract license info from uploaded documents (Azure/Google/Tesseract)
- **Monthly Cron Job** - Automated verification scheduling
- **Audit Logging** - Complete history of all system actions

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Storage)
- **Hosting**: Vercel with Cron

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- (Optional) OCR provider credentials (Azure/Google)
- (Optional) Nursys e-Notify API credentials

### Setup

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment variables example and fill in your values:

```bash
cp .env.local.example .env.local
```

3. Create a Supabase project and run the migrations:

```bash
# Apply migrations via Supabase CLI or dashboard
# Migrations are in: supabase/migrations/
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `CRON_SECRET` | Yes | Secret for authenticating cron requests |
| `OCR_PROVIDER` | No | OCR provider: `azure`, `google`, `tesseract`, or `none` |
| `AZURE_VISION_ENDPOINT` | No | Azure Computer Vision endpoint |
| `AZURE_VISION_KEY` | No | Azure Computer Vision key |
| `GOOGLE_VISION_API_KEY` | No | Google Cloud Vision API key |
| `NURSYS_ENOTIFY_API_URL` | No | Nursys e-Notify API URL |
| `NURSYS_ENOTIFY_API_KEY` | No | Nursys e-Notify API key |
| `NURSYS_ENOTIFY_ORG_ID` | No | Nursys organization ID |

## Database Schema

The application uses 11 main tables:

- `profiles` - User accounts linked to Supabase Auth
- `people` - Nurses and CNAs being tracked
- `licenses` - License records with status and expiration
- `verification_sources` - BON, CNA registry, Nursys sources
- `verifications` - Verification history (append-only)
- `verification_tasks` - Manual verification queue
- `documents` - Uploaded evidence files
- `import_batches` - CSV import history
- `verification_jobs` - Monthly cron job runs
- `audit_log` - System activity log (append-only)
- `nursys_enrollments` - Nursys e-Notify enrollment status

## User Roles

- **Admin** - Full access to all features including CRUD operations
- **Viewer** - Read-only access to people, licenses, verifications, and tasks

## Deployment

### Vercel

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

The monthly verification cron job is configured in `vercel.json` to run at 6 AM on the 1st of each month.

### Manual Cron Trigger

```bash
curl -X POST https://your-domain/api/cron/monthly-verification \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## License

Proprietary - Internal use only
