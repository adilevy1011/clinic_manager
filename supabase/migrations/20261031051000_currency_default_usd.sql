-- New clients and meetings default to USD for user-facing entry/display.
-- Existing records keep their saved currency preference.
alter table public.clients alter column currency set default 'USD';
alter table public.meetings alter column currency set default 'USD';
