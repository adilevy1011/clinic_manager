alter table public.meetings
  add column if not exists payment_status text not null default 'unpaid';

alter table public.meetings
  add column if not exists amount_paid numeric(10,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meetings_payment_status_check') then
    alter table public.meetings
      add constraint meetings_payment_status_check check (payment_status in ('unpaid', 'partial', 'paid'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'meetings_amount_paid_check') then
    alter table public.meetings
      add constraint meetings_amount_paid_check check (amount_paid >= 0);
  end if;
end;
$$;
