-- Pbooth — DOKU Checkout integration columns
-- Run via Supabase SQL editor or `supabase db push`.
--
-- Adds the columns needed to reconcile a Pbooth payment row with a
-- DOKU Checkout transaction. The webhook edge function uses the
-- service role key to write status updates; the kiosk only reads via
-- Realtime, so anon RLS stays as-is for now (mock provider still works).
-- Tighten anon UPDATE policy in a later migration once mock is removed.

alter table public.payments
  add column if not exists invoice_number text,
  add column if not exists payment_url text,
  add column if not exists provider_payload jsonb;

create index if not exists payments_invoice_idx on public.payments (invoice_number);
