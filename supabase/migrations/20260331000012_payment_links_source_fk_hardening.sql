-- Hardening: permitir source_record_id para quote y pre_event sin FK rígida a pre_events.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payment_links'
  ) then
    alter table public.payment_links
      drop constraint if exists payment_links_source_record_id_fkey;
  end if;
end
$$;
