create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('ILS', 'USD')),
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payments_client_date_idx on public.payments (therapist_id, client_id, payment_date desc);

alter table public.payments enable row level security;

create policy "therapists manage own payments" on public.payments
  for all using (auth.uid() = therapist_id)
  with check (
    auth.uid() = therapist_id
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.therapist_id = auth.uid()
    )
  );

-- Preserve any payment amounts already entered before the payment ledger existed.
insert into public.payments (therapist_id, client_id, meeting_id, amount, currency, payment_date, notes)
select therapist_id, client_id, id, amount_paid, currency, meeting_date, 'Imported from session payment amount'
from public.meetings
where amount_paid > 0
  and not exists (select 1 from public.payments p where p.meeting_id = public.meetings.id);
