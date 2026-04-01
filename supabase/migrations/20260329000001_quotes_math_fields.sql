-- Extiende cotizaciones para soportar cálculo automático con tipos/valores de descuento y depósito.

alter table public.quotes
  add column if not exists discount_type text not null default 'fixed'
    check (discount_type in ('fixed', 'percentage')),
  add column if not exists discount_value numeric(12,4) check (discount_value is null or discount_value >= 0),
  add column if not exists deposit_type text not null default 'fixed'
    check (deposit_type in ('fixed', 'percentage')),
  add column if not exists deposit_value numeric(12,4) check (deposit_value is null or deposit_value >= 0);

update public.quotes
set discount_type = coalesce(discount_type, 'fixed'),
    deposit_type = coalesce(deposit_type, 'fixed'),
    discount_value = coalesce(discount_value, discount_amount, 0),
    deposit_value = coalesce(deposit_value, expected_deposit, 0)
where true;
