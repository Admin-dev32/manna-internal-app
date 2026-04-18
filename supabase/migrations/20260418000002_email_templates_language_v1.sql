alter table public.email_templates
  add column if not exists language text not null default 'es';

alter table public.email_templates
  drop constraint if exists email_templates_language_check;

alter table public.email_templates
  add constraint email_templates_language_check
  check (language in ('es', 'en'));

drop index if exists email_templates_purpose_active_idx;
create index if not exists email_templates_purpose_language_active_idx
on public.email_templates (purpose, language, is_active);

drop index if exists email_templates_one_active_per_purpose_idx;
create unique index if not exists email_templates_one_active_per_purpose_language_idx
on public.email_templates (purpose, language)
where is_active = true;
