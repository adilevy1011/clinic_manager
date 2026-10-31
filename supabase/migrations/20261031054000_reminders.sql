create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text,
  remind_at timestamptz,
  recurrence text not null default 'once' check (recurrence in ('once', 'daily', 'weekly', 'after_session')),
  client_id uuid references public.clients(id) on delete cascade,
  email text,
  trigger_after_minutes integer not null default 0 check (trigger_after_minutes >= 0),
  completed boolean not null default false,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_after_session_client_check check (recurrence <> 'after_session' or client_id is not null)
);

create index if not exists reminders_due_idx on public.reminders (therapist_id, completed, remind_at);
create index if not exists reminders_client_idx on public.reminders (therapist_id, client_id, recurrence);

alter table public.reminders enable row level security;

create policy "therapists manage own reminders" on public.reminders
  for all using (auth.uid() = therapist_id)
  with check (
    auth.uid() = therapist_id
    and (client_id is null or exists (
      select 1 from public.clients c
      where c.id = client_id and c.therapist_id = auth.uid()
    ))
  );

drop trigger if exists reminders_updated_at on public.reminders;
create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();
