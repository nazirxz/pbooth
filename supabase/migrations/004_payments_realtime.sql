-- Pbooth — enable Supabase Realtime on payments
-- Required so the kiosk's `subscribePaymentStatus` can receive UPDATE
-- events pushed by the doku-webhook edge function. Without this, the
-- payment status will never flip on the kiosk UI even when DOKU
-- successfully notifies the webhook.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end
$$;
