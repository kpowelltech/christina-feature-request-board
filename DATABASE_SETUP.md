# Feature Request Board - Database Setup Guide

This guide will help you set up your Neon PostgreSQL database with Vercel.

## Prerequisites

- A Vercel account with your project deployed
- Access to Vercel Dashboard

## Step 1: Create Neon Database in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Feature Request Board project
3. Click on the **Storage** tab
4. Click **Create Database**
5. Select **Neon Postgres** (Serverless Postgres)
6. Choose your database name (e.g., `feature-request-board`)
7. Select your region (choose closest to your users)
8. Click **Create**

Vercel will automatically:
- Create a Neon database
- Add the `DATABASE_URL` environment variable to your project
- Make it available to all deployments

## Step 2: Get Your Database Connection String

After creating the database:

1. Go to **Storage** → **Neon Database** → **Settings**
2. Copy the **DATABASE_URL** value
3. It should look like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb`

## Step 3: Set Up Local Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your DATABASE_URL:

```env
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb"
```

**Important:** Add `.env` to your `.gitignore` (it should already be there)

## Step 4: Initialize Your Database

Run the initialization script to create tables and seed data:

```bash
npm run db:init
```

This will:
- Create the `feature_requests` table
- Set up indexes for performance
- Seed the database with your initial data (9 product + 20 AI feedback entries)

You should see output like:

```
🚀 Initializing Feature Request Board database...
📋 Reading schema...
🌱 Reading seed data...
🔨 Creating tables and indexes...
✅ Schema created successfully
📦 Seeding database with initial data...
✅ Database seeded successfully

📊 Database Summary:
  ai: 20 requests
  product: 9 requests

✨ Database initialization complete!
```

## Step 5: Verify Database in Vercel

1. Go to Vercel Dashboard → Storage → Your Neon Database
2. Click on **Query** tab
3. Run this query to verify:

```sql
SELECT channel, COUNT(*) as count
FROM feature_requests
GROUP BY channel;
```

You should see:
- `ai`: 20
- `product`: 9

## Step 6: Deploy API Routes

Your API routes are already set up in the `/api` directory. When you deploy to Vercel, these will automatically become serverless functions:

- `GET /api/requests/product` - Fetch all product requests
- `GET /api/requests/ai` - Fetch all AI feedback requests
- `POST /api/requests/create` - Create a new request
- `PATCH /api/requests/update` - Update a request status

## Step 7: Update Frontend to Use Database

Currently, your frontend uses static data files. To connect to the database API:

1. Update [src/App.jsx](feature-request-board/src/App.jsx) to fetch from API
2. Replace static imports with API calls:

```javascript
// Instead of:
import { REQUESTS_DATA } from "./requestsData";

// Use:
useEffect(() => {
  fetch('/api/requests/product')
    .then(res => res.json())
    .then(data => setProductData(data));
}, []);
```

## Database Schema

```sql
feature_requests (
  id VARCHAR(50) PRIMARY KEY,
  merchant VARCHAR(255),
  mrr INTEGER,
  arr INTEGER,
  type VARCHAR(50),  -- 'feature' or 'integration'
  category VARCHAR(100),
  request_group VARCHAR(255),
  request TEXT,
  context TEXT,
  submitted_by VARCHAR(255),
  date DATE,
  status VARCHAR(50),  -- 'pending', 'sent_to_slack', 'asana_created'
  asana_id VARCHAR(100),
  slack_ts VARCHAR(50),
  slack_user VARCHAR(50),
  channel VARCHAR(50),  -- 'product' or 'ai'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Troubleshooting

### Database connection fails

1. Check your `DATABASE_URL` is correct
2. Ensure Neon database is active in Vercel
3. Check if your IP is whitelisted (Neon allows all by default)

### Tables not created

1. Run `npm run db:reset` to reinitialize
2. Check database/schema.sql for syntax errors
3. Verify you have write permissions

### API routes return 500 error

1. Check Vercel logs: `vercel logs`
2. Ensure `DATABASE_URL` environment variable is set in Vercel
3. Verify database connection in Vercel dashboard

## Next Steps

- [ ] Connect frontend to API routes
- [ ] Set up Slack integration (optional)
- [ ] Configure Anthropic AI for message parsing (optional)
- [ ] Add authentication for API routes
- [ ] Set up automated Slack syncing with cron jobs

## Optional: Slack Integration

To enable automatic Slack syncing, add these environment variables:

```env
SLACK_BOT_TOKEN="xoxb-your-token"
PRODUCT_CHANNEL_ID="C123456789"
AI_FEEDBACK_CHANNEL_ID="C987654321"
ANTHROPIC_API_KEY="sk-ant-your-key"
```

Then run:

```bash
node slackSync.js --watch
```

## Useful Commands

```bash
# Initialize/reset database
npm run db:init

# Run locally
cd feature-request-board && npm run dev

# Deploy to Vercel
vercel --prod

# View logs
vercel logs
```

## Support

- [Neon Documentation](https://neon.tech/docs)
- [Vercel Postgres Guide](https://vercel.com/docs/storage/vercel-postgres)
- [Neon Transition Guide](https://neon.com/docs/guides/vercel-postgres-transition-guide)
