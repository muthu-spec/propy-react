# Vercel Deployment Guide - Blob Storage

## Architecture

| Component | Technology | Purpose |
|-----------|-------------|----------|
| Frontend | React + Vite | Static site on Vercel |
| Backend | Vercel Serverless Functions | Auto-deployed from `api/` folder |
| Storage | Vercel Blob | Persistent claims data |

## Vercel Blob Storage

| Tier | Storage | Bandwidth | Cost |
|------|----------|-----------|------|
| Free | 1GB | 1TB/month | FREE |

**How it works:**
- Claims stored as JSON files with prefix `potluck-claims-`
- Each save creates a new file with timestamp
- Keeps only the latest 10 versions (auto-cleanup)
- Fetches the latest file when reading

## Deployment Steps

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Use Vercel Blob storage"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Select your GitHub repository
4. Click "Deploy"

### Step 3: Enable Vercel Blob Storage

1. After deployment completes, go to your Vercel project dashboard
2. In left sidebar, click **"Storage"**
3. Click **"Blob"** tab
4. Click **"Create Blob Store"** button
5. Choose region (default is fine)
6. Click **"Create"**

### Step 4: Verify Environment Variable

Vercel automatically sets this variable when Blob is created:

| Variable | Source | Usage |
|----------|--------|--------|
| `BLOB_READ_WRITE_TOKEN` | Auto-set | Used by `api/claims.js` |

**No manual setup required** - This happens automatically when you create the Blob store.

### Step 5: Redeploy

After enabling Blob storage:

1. Go to Vercel Dashboard → **"Deployments"** tab
2. Find your latest deployment
3. Click the **"..."** (three dots) button
4. Click **"Redeploy"**

This ensures your serverless function has access to the Blob storage.

---

## API Endpoints

After deployment, your API will be at:

```
https://your-app.vercel.app/api/claims
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/claims` | Get all claims |
| GET | `/api/claims/:eventId` | Get claims for event |
| GET | `/api/claims/:eventId/items/:itemId` | Get item claimer |
| GET | `/api/claims/:eventId/guests/:guestName` | Get guest claims |
| POST | `/api/claims` | Add new claim |
| DELETE | `/api/claims/:eventId/items/:itemId` | Remove claim |

---

## Testing Multi-User Claims

1. Open your deployed app in Browser A
2. RSVP as "User A"
3. Open same URL in Browser B (incognito or different browser)
4. RSVP as "User B"
5. When User A claims an item, User B sees it within 3 seconds

---

## Troubleshooting

### Claims Not Persisting Between Users

**Check:**
- Is Blob storage enabled in Vercel Dashboard → Storage → Blob?
- Was app redeployed after enabling Blob?
- Check Vercel function logs (Dashboard → Functions → claims)

**Fix:** Make sure to redeploy after enabling Blob storage.

### CORS Errors

**Check:**
- Are you accessing from deployed URL (not localhost)?
- Check browser console for error messages

**Note:** CORS headers are enabled in the API function.

### 404 on API Routes

**Check:**
- Is `api/claims.js` in your repository root?
- Did Vercel deploy successfully (check build logs)?
- Check Vercel function logs (Dashboard → Functions → claims)

---

## Local Development

For local development, just run:

```bash
npm run dev
```

The app will use in-memory storage when Blob is not available (no environment setup needed).

---

## Production Considerations

For production with many users, consider migrating to:

| Database | Free Tier | Features |
|----------|-----------|----------|
| **Supabase** | 500MB PostgreSQL | Real-time sync, SQL |
| **Neon** | 0.5GB PostgreSQL | Serverless, auto-scaling |

Supabase is recommended because:
- Real-time subscriptions (no polling needed)
- Proper SQL queries
- Better scalability than Blob for many users
- Same free deployment on Vercel
