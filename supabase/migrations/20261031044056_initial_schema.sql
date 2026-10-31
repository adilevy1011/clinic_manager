create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text,
  currency text not null default 'ILS',
  timezone text not null default 'Asia/Jerusalem',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text,
  default_fee numeric(10,2) not null default 0 check (default_fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  meeting_date date not null,
  start_time time not null,
  cost numeric(10,2) not null default 0 check (cost >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_therapist_date_idx on public.meetings (therapist_id, meeting_date, start_time);
create index if not exists clients_therapist_idx on public.clients (therapist_id, active, name);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.meetings enable row level security;

create policy "therapists manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "therapists manage own clients" on public.clients for all using (auth.uid() = therapist_id) with check (auth.uid() = therapist_id);
create policy "therapists manage own meetings" on public.meetings for all using (auth.uid() = therapist_id) with check (auth.uid() = therapist_id and exists (select 1 from public.clients c where c.id = client_id and c.therapist_id = auth.uid()));

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at before update on public.meetings for each row execute function public.set_updated_at();
