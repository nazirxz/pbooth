# DOKU Checkout — Pbooth Integration

This document covers the QRIS via **DOKU Checkout** integration for the
Pbooth kiosk: how it's wired, how to deploy, and how to test in sandbox.

## Architecture

```
┌──────────────┐  POST create-doku-payment   ┌────────────────────────────┐
│ Pbooth kiosk │ ───────────────────────────▶│ Supabase Edge Function     │
│  (Electron)  │                             │ create-doku-payment        │
└──────────────┘                             │  • signs HMAC-SHA256       │
        ▲                                    │  • POST /checkout/v1/payment
        │ Realtime UPDATE                    │  • inserts payments row    │
        │   payments.id=eq.<id>              └────────┬───────────────────┘
        │                                             │
   ┌────┴───────────────┐                             ▼
   │ Supabase Postgres  │                    ┌────────────────┐
   │   public.payments  │◀───── update ──────│ doku-webhook   │
   └────────────────────┘                    │  (HMAC verify) │
                                             └────────▲───────┘
                                                      │
                                             ┌────────┴───────┐
                                             │   DOKU server  │
                                             └────────────────┘
```

The kiosk never holds the DOKU Secret Key. Edge functions own all
DOKU API calls; the kiosk only renders QR + subscribes to Realtime.

## Files Added

| File | Purpose |
|---|---|
| `supabase/migrations/003_doku_columns.sql` | adds `invoice_number`, `payment_url`, `provider_payload` to `payments` |
| `supabase/config.toml` | `verify_jwt = false` for `doku-webhook` |
| `supabase/functions/_shared/doku.ts` | HMAC signing, CORS, JSON helpers |
| `supabase/functions/create-doku-payment/` | kiosk → DOKU Checkout |
| `supabase/functions/doku-webhook/` | DOKU → Pbooth (status update) |
| `supabase/functions/dev-simulate-paid/` | sandbox-only shortcut for the kiosk's "DEV: SIMULATE PAID" button. Hard-locked when `DOKU_ENV=production`. |
| `src/lib/payment/qris-provider.ts` | renderer side; calls edge function + Realtime |

## Deployment

### 1. Install Supabase CLI (if not already)

```bash
brew install supabase/tap/supabase
supabase --version   # >= 1.150
```

### 2. Link the project (one-time)

```bash
cd /Users/swaynz/Portofolio/Pbooth
supabase link --project-ref ptrdmrlyckswfmrviqkl
# enter the personal access token when prompted
```

### 3. Apply the migration

Either via CLI:

```bash
supabase db push
```

…or paste `supabase/migrations/003_doku_columns.sql` into the
Supabase SQL editor.

### 4. Set edge function secrets

> ⚠️ Replace the values below with your sandbox credentials. Anything
> committed to chat or git should be considered leaked — regenerate the
> Secret Key in the DOKU back office before going to production.

```bash
supabase secrets set \
  DOKU_CLIENT_ID=doku_key_sandbox_b1021512158c4633afb7aebcce652872 \
  DOKU_SECRET_KEY=SK-QBF1gfRC8y0jJWeqOum3 \
  DOKU_BASE_URL=https://api-sandbox.doku.com \
  DOKU_DEFAULT_PAYMENT_DUE_MIN=5 \
  DOKU_WEBHOOK_REQUEST_TARGET=/functions/v1/doku-webhook
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 5. Deploy the functions

```bash
supabase functions deploy create-doku-payment
supabase functions deploy doku-webhook --no-verify-jwt
supabase functions deploy dev-simulate-paid
```

The `--no-verify-jwt` flag must match `verify_jwt = false` in
`supabase/config.toml` so DOKU can hit it without a Bearer token.

### 6. Register the webhook URL with DOKU

Send the URL below to your DOKU integration contact (or paste it in
the back office if your account has self-service callback config):

```
https://ptrdmrlyckswfmrviqkl.supabase.co/functions/v1/doku-webhook
```

If DOKU rejects the path or signs against a different `Request-Target`,
update `DOKU_WEBHOOK_REQUEST_TARGET` to match what DOKU is sending and
redeploy.

### 7. Switch the kiosk over

Edit `.env`:

```
VITE_PAYMENT_PROVIDER=doku
```

Restart `npm run dev` (Vite picks up env changes only on restart).

## Testing checklist (sandbox)

### How to "pay" in sandbox without real money

DOKU sandbox doesn't actually charge a real account, but the QR you
scan with a real banking app won't connect to a real bank either.
You have three ways to mark a sandbox payment as paid:

| Path | When to use | How |
|---|---|---|
| **DOKU Simulator** | Most realistic — exercises the full webhook → row-update path | Open https://sandbox.doku.com/gtw-config-v2/simulator → pick **QRIS** → paste invoice number from the kiosk (or copy from `payments.invoice_number`) → click **Pay**. DOKU sends a signed notification to `doku-webhook` and the row flips to `paid`. |
| **DEV: SIMULATE PAID** button | Fastest dev loop. Exercises the kiosk Realtime path but bypasses DOKU + signature verification. | Click the button on the kiosk Payment screen. The kiosk POSTs to `dev-simulate-paid` which marks the row paid via service role. The row keeps `provider_payload.dev_simulated = true` for audit. **Hard-locked when `DOKU_ENV=production`.** |
| **Real banking app** | If you want to verify the QRIS string itself parses correctly | Most banking apps will refuse to actually charge the sandbox merchant, so this only validates the QR is well-formed — not end-to-end payment. |

To hide the dev button in production, set
`payment.devSkipButton = false` in `src/config/app-config.ts` (or load
the value from env if you want runtime control).

### End-to-end scenarios

1. **Create a payment**
   - From a fresh `npm run dev`, click through to the Payment screen.
   - Expected: a QR appears within ~2 s, status reads `WAITING FOR PAYMENT`.
   - Verify in Supabase Studio → Table editor → `payments`: a new row
     with `provider='doku'`, `invoice_number='PBOOTH-…'`, populated
     `payment_url`, and `provider_payload.response.payment.url` matching.

2. **Scan + pay (sandbox simulator)**
   - On a phone, scan the kiosk QR. It should open the DOKU sandbox
     payment page.
   - Use the DOKU [QRIS simulator](https://sandbox.doku.com/gtw-config-v2/simulator)
     to mark the transaction successful.
   - Expected: kiosk flips to `● PAID — STARTING…` within ~1 s and
     advances to the template screen.
   - Verify in `payments`: `status='paid'`, `paid_at` set,
     `provider_payload.transaction.status='SUCCESS'`.

3. **Webhook signature (negative test)**
   - From a terminal, hit the webhook with a bogus signature:

     ```bash
     curl -X POST https://ptrdmrlyckswfmrviqkl.supabase.co/functions/v1/doku-webhook \
       -H 'Client-Id: doku_key_sandbox_b1021512158c4633afb7aebcce652872' \
       -H 'Request-Id: 00000000-0000-0000-0000-000000000000' \
       -H 'Request-Timestamp: 2026-05-28T02:00:00Z' \
       -H 'Signature: HMACSHA256=invalid' \
       -H 'Content-Type: application/json' \
       -d '{"order":{"invoice_number":"X"},"transaction":{"status":"SUCCESS"}}'
     ```
   - Expected: HTTP 401 `{"error":"invalid_signature"}`. The `payments`
     table must not change.

4. **Expired payment**
   - Lower `DOKU_DEFAULT_PAYMENT_DUE_MIN` to `1` and create a new
     payment. Wait > 1 min without paying.
   - Expected: DOKU pushes a notification with `transaction.status` of
     `EXPIRED`; webhook flips row to `expired`. Kiosk countdown reaches 0
     and shows `● EXPIRED`.

5. **Cancel from kiosk**
   - Tap `✕ CANCEL` while in `pending`.
   - Expected: row updated to `cancelled` locally (DOKU has no
     server-side cancel for Checkout — the page will just expire there).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `[doku] create payment failed: 401` | `DOKU_CLIENT_ID` or `DOKU_SECRET_KEY` mismatch on Supabase secrets. |
| `[doku] DOKU did not return a payment URL` | Sandbox account isn't activated for QRIS — contact DOKU. |
| Webhook returns `invalid_signature` repeatedly | `DOKU_WEBHOOK_REQUEST_TARGET` doesn't match the path DOKU is signing. Inspect the inbound request via `supabase functions logs doku-webhook`. |
| Kiosk QR generated but UI never flips to PAID | Realtime not enabled on `payments` table. In Supabase → Database → Replication, ensure `payments` is published. |
| `[doku] VITE_SUPABASE_URL not set` | `.env` missing or `VITE_PAYMENT_PROVIDER=doku` set without Supabase env. |

## Switching between sandbox and production

The DOKU integration runs against either DOKU sandbox or DOKU production
based on a single edge function secret: `DOKU_ENV`. The base URL is
auto-derived (`api-sandbox.doku.com` vs `api.doku.com`) so you don't
manually flip URLs.

### Server side (Supabase Edge Function secrets)

Switch to **sandbox** (testing):

```bash
SUPABASE_ACCESS_TOKEN=<pat> supabase secrets set \
  DOKU_ENV=sandbox \
  DOKU_CLIENT_ID=<sandbox client id> \
  DOKU_SECRET_KEY=<sandbox secret>
```

Switch to **production**:

```bash
SUPABASE_ACCESS_TOKEN=<pat> supabase secrets set \
  DOKU_ENV=production \
  DOKU_CLIENT_ID=<prod client id> \
  DOKU_SECRET_KEY=<prod secret>
```

No redeploy needed — Edge Functions read secrets fresh on every cold
start. To force-refresh hot instances, hit the function once with a
trivial request.

`DOKU_BASE_URL` can still be set explicitly to override the auto-derived
host (e.g., for testing against a staging tier).

Each created payment row stores `provider_payload.doku_env` and
`provider_payload.doku_base_url` so you can audit which environment a
transaction was created against:

```sql
select id, status, invoice_number, amount,
       provider_payload->>'doku_env'      as env,
       provider_payload->>'doku_base_url' as base_url
from public.payments
where provider = 'doku'
order by created_at desc
limit 10;
```

### Client side (Vite mode)

The kiosk uses Vite's built-in mode-specific env files. No code change
needed to switch — just run the right command:

| Command | Vite mode | Loads |
|---|---|---|
| `npm run dev` | development | `.env` + `.env.development` (+ `.env*.local`) |
| `npm run build` / `build:web` | production | `.env` + `.env.production` (+ `.env*.local`) |

So:
- **Dev workstation against sandbox** → `npm run dev` (auto-loads `.env.development`)
- **Production kiosk build** → `npm run build` (auto-loads `.env.production`)

Real production secrets that should never be committed go in
`.env.production.local` (gitignored). Vite layers them on top of
`.env.production`:

```sh
# .env.production.local (gitignored)
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=<prod anon>
```

## Production hardening checklist

When you are ready to flip the kiosk to a real DOKU production account,
do these in order — getting any one of them wrong has been a common
source of incidents at other merchants:

1. **Regenerate the sandbox Secret Key** in the DOKU back office (it's
   been pasted into chat history and should be considered compromised).
2. **Tighten RLS on `payments`**: drop the anon UPDATE policy added in
   `001_init.sql`. The doku-webhook uses the service role and doesn't
   need anon writes; the renderer never writes status anymore.
3. **Set production secrets** on Supabase using the command in the
   "Server side" section above (`DOKU_ENV=production` + matching
   credentials).
4. **Register the webhook URL on DOKU production** (it's a separate
   registration from sandbox):
   `https://<project-ref>.supabase.co/functions/v1/doku-webhook`
5. **Re-test end-to-end** with a real-but-tiny amount (e.g. Rp 1.000) to
   confirm: webhook signature passes → row updates → kiosk advances.
6. **Build kiosk with prod mode**: `npm run build` and ship the
   `dist-web/` (or electron) artifact. Verify the bundle's runtime env
   by opening DevTools and running
   `import.meta.env.VITE_PAYMENT_PROVIDER` (should print `doku`).
