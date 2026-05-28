# Pbooth

Retro-CRT photobooth kiosk app (Electron + React + Vite + Supabase + DOKU).

## Branch ↔ environment convention

Two long-lived branches, both share the same code. The active DOKU
environment is determined by the `DOKU_ENV` Supabase Edge Function
secret, **not** the branch — but by convention each branch is built
and run against one environment.

| Branch | Vite mode | Loads | Talks to (DOKU) | Used for |
|---|---|---|---|---|
| `development` ⭐ | dev (`npm run dev`) | `.env.development` | sandbox | Active dev, sandbox QA, dev simulator |
| `main` | production (`npm run build`) | `.env.production` | production | Tagged production releases |

The Vite mode flag chooses which `.env.[mode]` file loads. The Supabase
Edge Function reads `DOKU_ENV` to pick which DOKU credentials and base
URL to use — flip it with one command (no redeploy):

```bash
SUPABASE_ACCESS_TOKEN=<pat> supabase secrets set DOKU_ENV=production
# or
SUPABASE_ACCESS_TOKEN=<pat> supabase secrets set DOKU_ENV=sandbox
```

Both DOKU credential sets (`DOKU_SANDBOX_*`, `DOKU_PROD_*`) live on
Supabase simultaneously — switching is a single-secret toggle.

## Prerequisites

- Node 20+
- npm
- Supabase CLI 2.x (for edge function deploys + secret management)
- DOKU sandbox account (for development)

## Quickstart (development branch)

```bash
git checkout development
npm install

# Set up your sandbox env locally (gitignored — values aren't committed)
cp .env.example .env.development
# then edit .env.development and fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
# from the Supabase project (or get them from a teammate)

npm run dev          # http://localhost:5173 — uses sandbox DOKU
```

Click through to the Payment screen. Two ways to "pay" without real
money:

1. **DEV: SIMULATE PAID** button (only visible in `npm run dev` mode)
2. [DOKU sandbox simulator](https://sandbox.doku.com/gtw-config-v2/simulator)
   → paste the kiosk's invoice number → click pay

See `docs/doku-integration.md` for the full sandbox testing guide.

## Building for production (main branch)

```bash
git checkout main
git merge development          # bring forward fixes/features
npm install

# Set up your production env locally (gitignored)
cp .env.example .env.production
# fill in production VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
# (use a separate Supabase project for prod isolation if possible)

npm run build:web              # web kiosk artefacts → dist-web/
# or
npm run build                  # electron build (requires platform tooling)
```

Before the first production deploy from a clean account, run through
the **Production hardening checklist** in
`docs/doku-integration.md#production-hardening-checklist`.

## Environment files

All `.env*` files are gitignored — values stay on each developer's
machine. Use `.env.example` as the template:

| File | Tracked? | Purpose |
|---|---|---|
| `.env.example` | ✅ committed | template / onboarding reference |
| `.env.development` | 🚫 gitignored | sandbox values (loaded by `npm run dev`) |
| `.env.production` | 🚫 gitignored | production values (loaded by `npm run build`) |
| `.env` | 🚫 gitignored | fallback for both modes (optional) |
| `.env.development.local` | 🚫 gitignored | dev-only personal override |
| `.env.production.local` | 🚫 gitignored | prod-only personal override |

What kiosk env files contain:
- Supabase URL (public, RLS-protected)
- Supabase anon key (intentionally public, RLS-protected)
- `VITE_PAYMENT_PROVIDER`

What's **never** in those files:
- DOKU Client ID / Secret Key — live in Supabase Edge Function secrets
- RSA private keys — live in Supabase Edge Function secrets
- Service role key — Supabase only

## Where things live

```
src/
├── screens/             # Boot, Home, Payment, Capture, Decorate, Preview, Settings
├── components/          # CRT-styled UI primitives (TVButton, ChannelBar, …)
├── lib/
│   ├── payment/         # Provider abstraction (mock + doku)
│   ├── supabase/        # Typed wrappers for sessions/payments/photos
│   ├── camera/          # Webcam capture
│   ├── compose.ts       # Template + filter compositor
│   └── gif-encoder.ts   # GIF generation
├── state/               # Zustand stores (session, decoration, theme)
├── config/app-config.ts # Single source of truth for kiosk config
└── share/               # Read-only shared photo page

supabase/
├── migrations/          # SQL migrations (003 = DOKU columns, 004 = realtime)
├── functions/
│   ├── _shared/doku.ts          # HMAC signing, env helpers
│   ├── create-doku-payment/     # kiosk → DOKU /checkout/v1/payment
│   ├── doku-webhook/            # DOKU → us (signature-verified)
│   └── dev-simulate-paid/       # sandbox-only shortcut
└── config.toml          # function-level verify_jwt flags

docs/
└── doku-integration.md  # Architecture, deploy steps, switching, audit SQL
```

## Common tasks

### Apply a new SQL migration

```bash
SUPABASE_ACCESS_TOKEN=<pat> supabase db push
```

### Deploy edge functions

```bash
SUPABASE_ACCESS_TOKEN=<pat> supabase functions deploy create-doku-payment
SUPABASE_ACCESS_TOKEN=<pat> supabase functions deploy doku-webhook --no-verify-jwt
SUPABASE_ACCESS_TOKEN=<pat> supabase functions deploy dev-simulate-paid
```

### Audit which env a payment used

```sql
select id, status, invoice_number, amount,
       provider_payload->>'doku_env' as env
from public.payments
where provider = 'doku'
order by created_at desc
limit 10;
```

## Further reading

- `docs/doku-integration.md` — DOKU Checkout architecture, deploy
  steps, switching procedure, RSA keypair management, hardening
  checklist
