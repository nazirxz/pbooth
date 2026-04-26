-- Pbooth — initial schema
-- Run via Supabase SQL editor or `supabase db push`.

create extension if not exists "pgcrypto";

-- ─────────── EVENTS ───────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int not null default 15000,
  template_config jsonb,
  filter_config jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────── PAYMENTS ───────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  provider text not null,
  provider_ref text,
  amount int not null,
  status text not null check (status in ('pending','paid','expired','failed','cancelled')),
  qr_string text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_session_idx on public.payments (session_id);
create index if not exists payments_status_idx on public.payments (status);

-- ─────────── SESSIONS ───────────
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  status text not null check (status in ('pending_payment','paid','capturing','completed','expired','cancelled')),
  template_id text,
  filter_id text,
  payment_id uuid references public.payments(id) on delete set null,
  final_image_url text,
  live_video_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists sessions_status_idx on public.sessions (status);
create index if not exists sessions_created_idx on public.sessions (created_at desc);

-- Add FK from payments.session_id -> sessions(id) now that sessions exists.
alter table public.payments
  drop constraint if exists payments_session_id_fkey;
alter table public.payments
  add constraint payments_session_id_fkey
  foreign key (session_id) references public.sessions(id) on delete cascade;

-- ─────────── PHOTOS ───────────
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  frame_index int not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists photos_session_idx on public.photos (session_id);

-- ─────────── RLS ───────────
-- Start restrictive. Kiosk uses anon key with narrow policies.
alter table public.events   enable row level security;
alter table public.sessions enable row level security;
alter table public.payments enable row level security;
alter table public.photos   enable row level security;

-- Events: readable by anon (active event info), writable only by service role.
drop policy if exists "events_read_anon" on public.events;
create policy "events_read_anon" on public.events for select to anon using (true);

-- Sessions: anon can insert a new session and update its own via id (client tracks id).
-- NOTE: this is intentionally permissive for PoC kiosk. Tighten once auth model is finalized.
drop policy if exists "sessions_insert_anon" on public.sessions;
create policy "sessions_insert_anon" on public.sessions for insert to anon with check (true);

drop policy if exists "sessions_read_anon" on public.sessions;
create policy "sessions_read_anon" on public.sessions for select to anon using (true);

drop policy if exists "sessions_update_anon" on public.sessions;
create policy "sessions_update_anon" on public.sessions for update to anon using (true) with check (true);

-- Payments: anon can create + read + (for mock) update. In prod, updates should be server-only via webhook/edge function.
drop policy if exists "payments_insert_anon" on public.payments;
create policy "payments_insert_anon" on public.payments for insert to anon with check (true);

drop policy if exists "payments_read_anon" on public.payments;
create policy "payments_read_anon" on public.payments for select to anon using (true);

drop policy if exists "payments_update_anon" on public.payments;
create policy "payments_update_anon" on public.payments for update to anon using (true) with check (true);

-- Photos: anon can insert + read.
drop policy if exists "photos_insert_anon" on public.photos;
create policy "photos_insert_anon" on public.photos for insert to anon with check (true);

drop policy if exists "photos_read_anon" on public.photos;
create policy "photos_read_anon" on public.photos for select to anon using (true);

-- ─────────── STORAGE BUCKETS ───────────
-- Run once in SQL editor (Supabase).
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('composed', 'composed', true) -- public so QR download URL works
  on conflict (id) do nothing;

-- Storage policies: anon can upload + read within the session scope.
-- Tighten in production to scope-per-session.
drop policy if exists "photos_upload_anon" on storage.objects;
create policy "photos_upload_anon" on storage.objects
  for insert to anon
  with check (bucket_id in ('photos','composed'));

drop policy if exists "photos_read_anon" on storage.objects;
create policy "photos_read_anon" on storage.objects
  for select to anon
  using (bucket_id in ('photos','composed'));
