-- Soporte multiselección para servicios de interés en leads.

alter table public.leads
  add column if not exists service_interests text[];

update public.leads
set service_interests = case
  when service_interest is null or btrim(service_interest) = '' then null
  when service_interest like '[%' and service_interest like '%]' then
    (
      select array_agg(value)
      from jsonb_array_elements_text(service_interest::jsonb) as value
    )
  when strpos(service_interest, ' + ') > 0 then regexp_split_to_array(service_interest, '\s\+\s')
  when strpos(service_interest, ',') > 0 then regexp_split_to_array(service_interest, '\s*,\s*')
  else array[service_interest]
end
where service_interests is null;

create index if not exists leads_service_interests_gin_idx
  on public.leads using gin (service_interests);
