# Cloudflare R2 Storage Setup

This guide explains how to set up Cloudflare R2 storage for the Pbooth photobooth application with automatic 3-day photo expiration.

## Prerequisites

- Cloudflare account with R2 enabled
- R2 bucket created (e.g., `pbooth-photos`)
- R2 API credentials (Access Key ID and Secret Access Key)

## Step 1: Create R2 Bucket

1. Log in to your Cloudflare dashboard
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name it `pbooth-photos` (or your preferred name)
5. Click **Create bucket**

## Step 2: Configure Lifecycle Rule (3-Day Auto-Deletion)

1. Open your R2 bucket
2. Go to **Settings** → **Lifecycle rules**
3. Click **Add rule**
4. Configure:
   - **Rule name**: `auto-delete-after-3-days`
   - **Action**: Delete objects
   - **Days after creation**: `3`
   - **Prefix**: (leave empty to apply to all objects)
5. Click **Save**

Objects will be automatically deleted 3 days after creation (typically runs once daily around midnight UTC).

## Step 3: Generate API Credentials

1. In Cloudflare dashboard, go to **R2** → **Manage R2 API Tokens**
2. Click **Create API token**
3. Configure permissions:
   - **Permissions**: Object Read & Write
   - **Buckets**: Select your `pbooth-photos` bucket (or "All R2 buckets")
4. Click **Create API Token**
5. Copy the credentials:
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint URL** (format: `https://<account-id>.r2.cloudflarestorage.com`)

⚠️ **Important**: Save these credentials securely. The Secret Access Key is only shown once.

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env.development` (for local development) or `.env.production` (for production):
   ```bash
   cp .env.example .env.development
   ```

2. Edit the file and add your R2 credentials:
   ```bash
   # Storage Backend
   VITE_STORAGE_BACKEND=r2

   # Cloudflare R2 Storage
   VITE_R2_ACCOUNT_ID=<your-account-id-from-endpoint>
   VITE_R2_ACCESS_KEY_ID=<your-access-key-id>
   VITE_R2_SECRET_ACCESS_KEY=<your-secret-access-key>
   VITE_R2_BUCKET_NAME=pbooth-photos
   ```

3. Extract the Account ID from your endpoint URL:
   - Endpoint: `https://b5ee2f755038251cf1e0dd2ec6a968f9.r2.cloudflarestorage.com`
   - Account ID: `b5ee2f755038251cf1e0dd2ec6a968f9`

## Step 5: (Optional) Set Up Custom Domain for Public Access

For better performance on composed strips and GIFs, you can configure a custom domain:

1. In your R2 bucket settings, go to **Settings** → **Public access**
2. Click **Connect domain**
3. Enter your domain (e.g., `photos.pbooth.vercel.app`)
4. Follow the DNS configuration instructions
5. Add to your `.env` file:
   ```bash
   VITE_R2_PUBLIC_URL=https://photos.pbooth.vercel.app
   ```

If you skip this step, all content will use presigned URLs (7-day expiration), which works fine but adds slight latency.

## Step 6: Set Up Database Cleanup (Edge Function)

The R2 lifecycle rule deletes objects after 3 days, but database metadata remains. Set up automatic cleanup:

### Deploy the Edge Function

```bash
npx supabase functions deploy cleanup-expired-sessions
```

### Set Up Cron Trigger

**Option A: External Cron Service (Recommended)**

Use a service like [cron-job.org](https://cron-job.org) or GitHub Actions:

1. Get your edge function URL:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/cleanup-expired-sessions
   ```

2. Set up a daily cron job to call this URL with your Supabase anon key:
   ```bash
   curl -X POST https://<your-project-ref>.supabase.co/functions/v1/cleanup-expired-sessions \
     -H "Authorization: Bearer <your-anon-key>"
   ```

3. Schedule it to run daily (e.g., 2 AM UTC)

**Option B: Supabase pg_cron Extension**

If your Supabase plan supports pg_cron:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM UTC
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/cleanup-expired-sessions',
    headers := '{"Authorization": "Bearer <your-anon-key>"}'::jsonb
  );
  $$
);
```

## Step 7: Test the Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Complete a full photobooth session (payment → capture → decorate → preview)

3. Verify in Cloudflare R2 dashboard:
   - Check that objects appear in your bucket under `{sessionId}/frames/`, `{sessionId}/composed/`, and `{sessionId}/live/`

4. Test the share page:
   - Scan the QR code or open `http://localhost:5173/s/{sessionId}`
   - Verify all images load correctly

5. Check browser DevTools Network tab:
   - Verify R2 presigned URLs are being used
   - All image requests should return 200 OK

## Rollback to Supabase Storage

If you need to switch back to Supabase Storage:

1. Edit your `.env` file:
   ```bash
   VITE_STORAGE_BACKEND=supabase
   ```

2. Restart the application

New sessions will use Supabase Storage. Existing R2 sessions remain accessible (presigned URLs valid for 7 days).

## Troubleshooting

### Photos not uploading to R2

- Check browser console for `[r2]` log messages
- Verify R2 credentials are correct in `.env` file
- Ensure `VITE_STORAGE_BACKEND=r2` is set
- Check Cloudflare R2 dashboard for API token permissions

### Share page images not loading

- Check browser console for 403 Forbidden errors
- Verify presigned URLs are being generated (check Network tab)
- Ensure R2 bucket has correct CORS settings if accessing from different domain

### Lifecycle rule not deleting objects

- Lifecycle rules run once per day (typically around midnight UTC)
- Objects created on Day 0 are deleted on Day 3 (72+ hours later)
- Check Cloudflare R2 dashboard → Bucket → Settings → Lifecycle rules to verify rule is enabled

### Database cleanup not running

- Verify edge function is deployed: `npx supabase functions list`
- Test manually: `curl -X POST https://<your-project-ref>.supabase.co/functions/v1/cleanup-expired-sessions -H "Authorization: Bearer <your-anon-key>"`
- Check cron service logs to ensure it's calling the endpoint

## Cost Estimate

For 100 sessions/day with 3-day retention:

- **Storage**: ~$0.005/month (30 sessions × 10MB)
- **Uploads**: ~$0.08/month (18,000 writes)
- **Downloads**: ~$0.13/month (360,000 reads)
- **Total**: ~$0.22/month

Compared to Supabase Storage: ~$5-10/month (egress fees are the main cost driver)

**Savings**: ~$5-10/month (more significant at scale)

## Security Notes

- R2 credentials are embedded in the client-side bundle (acceptable for public photobooth use case)
- Credentials are scoped to a single bucket with write-only permissions
- No sensitive data in photos (public photobooth content)
- Presigned URLs expire after 7 days
- Session IDs are UUIDs (unguessable)

For enhanced security, consider moving uploads to a Supabase Edge Function to keep credentials server-side (adds ~200-500ms latency per upload).
