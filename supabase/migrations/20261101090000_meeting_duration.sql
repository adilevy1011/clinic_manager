alter table public.meetings
  add column if not exists duration_minutes integer not null default 50;

alter table public.meetings
  drop constraint if exists meetings_duration_minutes_check;

alter table public.meetings
  add constraint meetings_duration_minutes_check check (duration_minutes between 1 and 1440);
