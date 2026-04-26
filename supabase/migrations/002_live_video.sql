-- Pbooth — add live photo (video) URL to sessions
-- Run via Supabase SQL editor on existing installs.

alter table public.sessions
  add column if not exists live_video_url text;
