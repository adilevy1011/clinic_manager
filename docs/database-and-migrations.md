# Database and migrations

## Principles

Supabase Postgres is the source of persisted application data. FastAPI is the only application layer that talks to it. Row ownership is represented by the authenticated user ID and protected by route authorization plus database policies.

Migration files are ordered by timestamp and run once. The initial schema is already pushed and is immutable. Schema evolution belongs in a new migration, even when the change feels small.

## Migration history

- `20261031044056_initial_schema.sql`: base users, clients, meetings, and core policies.
- `20261031050000_currency_preferences.sql` and `20261031051000_currency_default_usd.sql`: currency preference support/default display behavior.
- `20261031052000_client_notes.sql`: client comments/notes.
- `20261031053000_payment_tracking.sql`: meeting payment state.
- `20261031054000_reminders.sql`: reminders and reminder delivery metadata.
- `20261031055000_client_payments.sql`: client payment ledger.
- `20261031060000_meeting_recurrence_series.sql`: series definitions, exception metadata, and recurrence indexes.

The exact SQL remains authoritative; this list is a map, not a replacement for reading the migration files.

## Creating a migration

Create a new timestamped file under `supabase/migrations/`, keep it transactional where practical, and make it safe for the current database state with guarded changes where appropriate. Add policies for new user-owned tables and indexes for user/date queries. Update backend schemas and routes in the same change.

Test locally with `supabase db reset`, inspect the resulting schema, then push a linked project with `supabase db push`. Never rewrite history to repair an already-applied migration; add a corrective migration.

## Data semantics

Fees are floating-point-compatible numeric values at the API boundary and are stored canonically in ILS. A meeting may remember the last input/display currency, but summaries convert/display from the canonical value. Recurring definitions are expanded for reporting; virtual occurrences are not independently persisted unless the therapist edits or deletes one, in which case an exception row records the change.
