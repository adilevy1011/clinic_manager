-- Amounts remain canonical ILS; this stores the preferred display/input currency per record.
alter table public.clients
  add column if not exists currency text not null default 'ILS';

alter table public.meetings
  add column if not exists currency text not null default 'ILS';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_currency_check') then
    alter table public.clients
      add constraint clients_currency_check check (currency in ('ILS', 'USD'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'meetings_currency_check') then
    alter table public.meetings
      add constraint meetings_currency_check check (currency in ('ILS', 'USD'));
  end if;
end;
$$;
