-- Global runtime settings shared by the admin panel and long-running kiosks.

create table if not exists public.app_settings (
  key text primary key,
  session_price integer not null check (session_price > 0 and session_price <= 100000000),
  currency text not null default 'IDR' check (currency = 'IDR'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint app_settings_global_key check (key = 'global')
);

insert into public.app_settings (key, session_price, currency)
values ('global', 37000, 'IDR')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings
  for select to anon, authenticated
  using (key = 'global');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
