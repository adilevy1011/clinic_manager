# Stillpoint Clinic Manager

Stillpoint Clinic Manager is a private-practice workspace for therapists. It keeps the therapist's schedule, client profiles, recurring sessions, fees, payment history, reminders, and monthly financial summaries in one place.

The application is intentionally therapist-facing. Clients do not receive accounts and the browser never talks directly to Supabase. The frontend calls the FastAPI backend, while FastAPI owns authentication, database access, recurrence expansion, financial calculations, and Resend email delivery.

## What is included

- HTTP-only cookie login and logout backed by Supabase Auth.
- A “Your Day” landing page with the day's schedule and payment summary.
- Calendar, sessions, clients, money management, reminders, and settings pages.
- Client profiles with notes, default fees, meeting summaries, and payment logs.
- Canonical ILS storage with USD/ILS display and input conversion.
- Monthly reporting that distinguishes completed sessions owed from scheduled sessions anticipated.
- Weekly and monthly recurring meeting series with exception rows and end dates.
- Reminder emails sent by Resend through a separate worker process.
- Nginx and systemd templates for deployment behind a domain such as `clinic.example.com`.

## Repository map

```text
backend/                 FastAPI application and reminder worker
  app/                   configuration, database client, schemas, dependencies, routers
frontend/                static HTML, CSS, and browser JavaScript
  js/                    API client, state, rendering, formatting, and page boot logic
supabase/migrations/     append-only database migrations
deploy/                  systemd and Nginx templates
docs/                    development, data model, and operations guides
```

## Architecture at a glance

```text
Browser
  └── FastAPI /api/* ── Supabase Auth + PostgREST/Postgres
                    └── Resend (reminder worker only)
```

Supabase credentials and Resend credentials are backend-only environment variables. Do not add them to frontend JavaScript or commit real values. See [docs/architecture.md](docs/architecture.md) and [docs/security.md](docs/security.md).

## Start locally

```bash
python -m pip install -r backend/requirements.txt
uvicorn main:app --app-dir backend --reload --port 8017 --env-file backend/.env
python -m http.server 3000 --directory frontend
```

Open `http://localhost:3000`. Copy `backend/.env.example` to `backend/.env` and fill in a development Supabase project before using real authentication. Supabase migrations can be applied locally with the Supabase CLI, or pushed to a linked project with `supabase db push`.

The frontend includes a demo mode for browsing the interface without a backend. For real login, use a backend configured with `FRONTEND_URL=http://localhost:3000` and the matching CORS origin. More complete commands and troubleshooting are in [docs/local-development.md](docs/local-development.md).

## Database changes

Migrations are append-only. The initial schema has already been applied and must not be edited. Add a new timestamped SQL file under `supabase/migrations/` for every schema change. See [docs/database-and-migrations.md](docs/database-and-migrations.md).

## Production deployment

The deployment templates assume the repository is available at `/var/www/clinic-manager`, the virtual environment is `/var/www/clinic-manager/.venv`, and Uvicorn listens only on `127.0.0.1:8017`. They intentionally use a placeholder Nginx `server_name`; set the real domain in the server environment rather than committing it to the repository.

- `deploy/clinic-manager.service` runs FastAPI.
- `deploy/clinic-manager-reminder-worker.service` runs scheduled reminder delivery.
- `deploy/clinic-manager.nginx.conf` serves the frontend and proxies `/api` to Uvicorn.

Read [docs/deployment.md](docs/deployment.md) before enabling the services. It includes the symlinked `/var/www/clinic-manager` layout, permissions, Nginx extensionless routes, TLS, upgrades, and rollback considerations.

## Further documentation

- [Architecture and request flow](docs/architecture.md)
- [Local development and testing](docs/local-development.md)
- [Deployment and operations](docs/deployment.md)
- [Database and migrations](docs/database-and-migrations.md)
- [Recurring meetings](docs/recurring-meetings.md)
- [Finance and payments](docs/finance-and-payments.md)
- [Reminders and email](docs/reminders.md)
- [Frontend conventions](docs/frontend-conventions.md)
- [Security](docs/security.md)
