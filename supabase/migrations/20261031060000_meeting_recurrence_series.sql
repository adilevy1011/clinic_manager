alter table public.meetings add column if not exists series_id uuid default gen_random_uuid();
alter table public.meetings add column if not exists recurrence_rule jsonb;
alter table public.meetings add column if not exists recurrence_end_date date;
alter table public.meetings add column if not exists recurrence_occurrence_date date;
alter table public.meetings add column if not exists recurrence_exception_type text;

update public.meetings set series_id = id where series_id is null;
alter table public.meetings alter column series_id set not null;

alter table public.meetings drop constraint if exists meetings_recurrence_exception_type_check;
alter table public.meetings add constraint meetings_recurrence_exception_type_check
  check (recurrence_exception_type is null or recurrence_exception_type in ('cancelled', 'override'));

create index if not exists meetings_series_idx on public.meetings (therapist_id, series_id, recurrence_occurrence_date);
