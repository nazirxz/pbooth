# Pbooth: private Cloudflare R2 setup

Pbooth stores new photo bytes in a private R2 bucket while Supabase remains the
source of truth for sessions, payments, metadata, Auth, and signing APIs.

## Fixed storage layout

Bucket: `euorna-storage`

S3 endpoint (do not append the bucket name):

```text
https://b5ee2f755038251cf1e0dd2ec6a968f9.r2.cloudflarestorage.com
```

Object keys are generated server-side only:

```text
frames/{sessionId}/frame_0.jpg
frames/{sessionId}/frame_1.jpg
frames/{sessionId}/frame_2.jpg
frames/{sessionId}/frame_3.jpg
composed/{sessionId}/final.jpg
live/{sessionId}/live.{gif|webm|mp4}
```

Keep the bucket private. Do not enable `r2.dev` or a public custom domain.

## 1. Configure lifecycle rules

In Cloudflare Dashboard, open **R2 → euorna-storage → Settings → Object
lifecycle rules** and create these three enabled rules:

| Name | Prefix | Expire objects after |
| --- | --- | --- |
| `expire-raw-frames` | `frames/` | 1 day |
| `expire-composed` | `composed/` | 3 days |
| `expire-live` | `live/` | 3 days |

R2 lifecycle execution is asynchronous. The application also enforces the
expiry timestamp from PostgreSQL, so an object cannot be shared after its
retention window even if physical deletion is a few hours late.

Upload one canary object under each prefix and verify the configured rule in
the Cloudflare dashboard before enabling R2 in the kiosk build.

## 2. Configure bucket CORS

The packaged Electron app is loaded from `file://`, which Chromium represents
as an opaque (`null`) origin. Use a wildcard origin so its presigned requests
pass preflight as well as requests from the web share page and local Vite. This
does not make the bucket public: every request still needs a short-lived,
single-object presigned URL.

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

Keep **Public Development URL** and public custom-domain access disabled.

The browser receives only five-minute presigned PUT URLs and fifteen-minute
presigned GET URLs. R2 API credentials never enter the renderer.

## 3. Create the R2 API token

Create an R2 API token scoped only to `euorna-storage` with Object Read & Write
permission. Record the Access Key ID and Secret Access Key once.

## 4. Apply database migration

Link/login to the intended Supabase project, inspect the pending migration,
then push it:

```bash
supabase login
supabase migration list
supabase db push
```

Migration `005_secure_r2_storage.sql` is additive. Existing Supabase objects
are not copied to R2. Their metadata is backfilled with the new retention
timestamps and the cleanup function removes their bytes after expiry.

## 5. Set Edge Function secrets

Create a long random cleanup secret, then configure secrets on Supabase. Never
prefix these names with `VITE_` and never put them in `.env.production`.

```bash
supabase secrets set \
  R2_ENDPOINT=https://b5ee2f755038251cf1e0dd2ec6a968f9.r2.cloudflarestorage.com \
  R2_ACCOUNT_ID=b5ee2f755038251cf1e0dd2ec6a968f9 \
  R2_BUCKET_NAME=euorna-storage \
  R2_ACCESS_KEY_ID='<access-key-id>' \
  R2_SECRET_ACCESS_KEY='<secret-access-key>' \
  CLEANUP_CRON_SECRET='<random-256-bit-secret>'
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
provided automatically to deployed Edge Functions.

## 6. Deploy Edge Functions

```bash
supabase functions deploy r2-sign-upload
supabase functions deploy r2-complete-upload
supabase functions deploy shared-session
supabase functions deploy cleanup-expired-assets
supabase functions deploy cleanup-expired-sessions
supabase functions deploy admin-sessions
```

`cleanup-expired-sessions` remains as a safe compatibility alias for an old
cron. It no longer deletes sessions or payment rows.

## 7. Configure admin access

Create the administrator through **Supabase Auth → Users**, then add its UUID
to the allowlist:

```sql
insert into public.admin_users (user_id)
values ('<auth-user-uuid>')
on conflict (user_id) do nothing;
```

The `/admin` page now signs in with that Auth email/password. Every admin read,
signed download, and explicit delete is authorized again inside
`admin-sessions`.

## 8. Schedule asset cleanup

Call this endpoint once per day from a scheduler that can keep the header
secret private:

```bash
curl --fail-with-body --request POST \
  'https://ptrdmrlyckswfmrviqkl.supabase.co/functions/v1/cleanup-expired-assets' \
  --header 'x-cleanup-secret: <CLEANUP_CRON_SECRET>'
```

Expected response includes `sessionsDeleted: 0`. Cleanup deletes expired
legacy Supabase objects and marks metadata expired. R2 byte deletion remains
the responsibility of the lifecycle rules.

## 9. Enable R2 for new sessions

Only after migration, secrets, functions, lifecycle, and CORS are verified,
set this public build-time flag:

```text
VITE_STORAGE_BACKEND=r2
```

Build the web share page and Windows development installer after changing the
flag. Roll back new sessions by rebuilding with
`VITE_STORAGE_BACKEND=supabase`; mixed-backend reads continue to work because
each asset row records its own backend.

## Canary checklist

- Complete one paid session with four JPEGs, final composition, and live asset.
- Confirm keys use `frames/`, `composed/`, and `live/` prefixes exactly.
- Confirm no R2 Access Key ID, secret key, service-role key, or admin password
  appears in `dist/` or the installer bundle.
- Scan the QR and confirm its URL contains both `/s/{sessionId}` and `?t=`.
- Confirm a wrong token and unpaid session are rejected.
- Confirm a file over 50 MiB is rejected.
- Confirm four raw uploads never exceed two concurrent requests.
- Repeat with five simultaneous sessions before full rollout.
- After 24 hours, raw frames must disappear from the share page.
- After three days, final/live must show the expired state.
- Confirm cleanup retains session and payment rows.

At 40 sessions/day with four 23 MB raw photos, incoming raw bytes are about
3.68 GB/day. One-day raw retention plus three-day final/live retention should
normally stay within the 10 GB-month R2 free storage allowance, but billing
must still be enabled and usage/cleanup lag should be monitored.
