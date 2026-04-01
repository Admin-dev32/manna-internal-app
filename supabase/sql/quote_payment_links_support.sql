-- Extiende payment_links para soportar origen desde cotización sin romper reservas.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payment_links'
  ) then
    alter table public.payment_links
      drop constraint if exists payment_links_source_record_type_check;

    alter table public.payment_links
      add constraint payment_links_source_record_type_check
      check (source_record_type in ('pre_event', 'quote'));
  end if;
end
$$;
