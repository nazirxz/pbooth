-- Secure mixed-backend storage for Pbooth.
-- Existing rows remain on Supabase; new uploads can use private Cloudflare R2.

alter table public.photos
  add column if not exists storage_backend text not null default 'supabase',
  add column if not exists size_bytes bigint,
  add column if not exists expires_at timestamptz,
  add column if not exists expired_at timestamptz;

alter table public.photos
  drop constraint if exists photos_storage_backend_check;
alter table public.photos
  add constraint photos_storage_backend_check
  check (storage_backend in ('supabase', 'r2'));

alter table public.sessions
  add column if not exists final_storage_backend text,
  add column if not exists final_storage_path text,
  add column if not exists live_storage_backend text,
  add column if not exists live_storage_path text,
  add column if not exists final_expires_at timestamptz,
  add column if not exists live_expires_at timestamptz,
  add column if not exists assets_expired_at timestamptz,
  add column if not exists share_token_hash text;

alter table public.sessions
  drop constraint if exists sessions_final_storage_backend_check;
alter table public.sessions
  add constraint sessions_final_storage_backend_check
  check (final_storage_backend is null or final_storage_backend in ('supabase', 'r2'));

alter table public.sessions
  drop constraint if exists sessions_live_storage_backend_check;
alter table public.sessions
  add constraint sessions_live_storage_backend_check
  check (live_storage_backend is null or live_storage_backend in ('supabase', 'r2'));

-- Legacy assets follow the new retention policy without moving their bytes.
update public.photos
set expires_at = created_at + interval '1 day'
where expires_at is null;

update public.sessions
set
  final_storage_backend = case
    when final_image_url is not null and final_storage_backend is null then 'supabase'
    else final_storage_backend
  end,
  live_storage_backend = case
    when live_video_url is not null and live_storage_backend is null then 'supabase'
    else live_storage_backend
  end,
  final_expires_at = case
    when final_image_url is not null and final_expires_at is null then created_at + interval '3 days'
    else final_expires_at
  end,
  live_expires_at = case
    when live_video_url is not null and live_expires_at is null then created_at + interval '3 days'
    else live_expires_at
  end;

create index if not exists photos_expiry_idx
  on public.photos (expires_at)
  where expired_at is null;
create index if not exists sessions_asset_expiry_idx
  on public.sessions (final_expires_at, live_expires_at)
  where assets_expired_at is null;
create index if not exists sessions_share_token_idx
  on public.sessions (id, share_token_hash);

-- Make raw-frame completion idempotent. Keep the newest duplicate metadata row
-- if earlier client-side retries inserted more than one row.
delete from public.photos older
using public.photos newer
where older.session_id = newer.session_id
  and older.frame_index = newer.frame_index
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists photos_session_frame_unique
  on public.photos (session_id, frame_index);

-- Admin access uses Supabase Auth plus an explicit allowlist. The table is
-- intentionally unreadable to anon users.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_read_self" on public.admin_users;
create policy "admin_users_read_self" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

-- Direct anon writes are no longer needed for photo metadata once the R2
-- completion function owns them. Legacy Supabase uploads still need the old
-- policy during rollback, so it remains until the rollout is proven stable.
