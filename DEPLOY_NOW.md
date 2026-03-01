# Quick Deployment Guide - Vercel Serverless Functions with Blob

## What Was Done

✅ Created Vercel serverless function at `api/claims.js`
✅ Implemented Vercel Blob storage for persistence (fallback to in-memory for local dev)
✅ Updated frontend to use Vercel API URL
✅ Added @vercel/blob dependency
✅ Removed Express server (server.js)
✅ Created deployment documentation

---

## Steps to Deploy to Vercel

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

Vercel will automatically:
- Detect Vite configuration
- Build your React app
- Deploy `api/` folder as serverless functions

### Step 3: Enable Vercel Blob Storage

1. After initial deployment completes, go to your Vercel project dashboard
2. In the left sidebar, click **"Storage"**
3. Click **"Blob"** tab
4. Click **"Create Blob Store"** button
5. Choose region (default is fine)
6. Click **"Create"**

### Step 4: Verify Environment Variable (Auto-Set)

Vercel automatically sets the required environment variable:

| Variable | Value | Description |
|----------|-------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Auto-set by Vercel | Token for Blob access |

**No manual setup needed** - This is automatically configured when you create the Blob store.

### Step 5: Redeploy

After enabling Blob storage:

1. Go to your Vercel project dashboard
2. Click **"Deployments"** tab
3. Click **"..."** (three dots) on the latest deployment
4. Click **"Redeploy"**

This ensures the Blob storage is connected and your serverless function has access to it.

---

## Verify It Works

After redeployment:

1. Open your deployed app: `https://your-app.vercel.app`
2. Navigate to an event: `https://your-app.vercel.app/join/test-event`
3. RSVP as "User A"
4. Open same URL in browser B (incognito window)
5. RSVP as "User B"
6. When User A claims an item, User B should see it within 3 seconds (polling)

---

## Troubleshooting

### Claims Not Persisting Between Users

**Check:**
1. Is Blob storage enabled in Vercel Dashboard?
2. Was the app redeployed after enabling Blob?
3. Check Vercel function logs for errors (Dashboard → Functions → claims)

**Common Fix:**
- Make sure you clicked "Redeploy" after enabling Blob
- Wait for redeployment to complete before testing

### CORS Errors

**Check:**
1. Are you accessing from the deployed URL (not localhost)?
2. Check browser console for specific error messages

**Note:** The API has CORS headers enabled. If testing from different domains, they should work.

### 404 on API Routes

**Check:**
1. Is `api/claims.js` in your repository root?
2. Did Vercel deploy successfully (check build logs)?
3. Check Vercel function logs (Dashboard → Functions → claims)

---

## Environment Variables

For Vercel Blob deployment, you **don't need to manually set** environment variables. Vercel automatically provides:

| Variable | When Set | Usage |
|----------|----------|--------|
| `BLOB_READ_WRITE_TOKEN` | When Blob store is created | Used by `api/claims.js` |

**Note:** The frontend (`src/services/claims-api.ts`) uses a relative URL by default, which works automatically in Vercel.

---

## Vercel Blob Pricing (Free)

| Resource | Free Tier |
|----------|-----------|
| Storage | 1GB |
| Bandwidth | 1TB/month |
| Cost | $0 |

This is sufficient for testing and moderate usage. For production with many users, consider Supabase (500MB PostgreSQL + real-time sync).

---

## Local Development

For local development, run:

```bash
npm run dev
```

The app will use in-memory storage when Blob is not available (no environment setup needed for local dev).
