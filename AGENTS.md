# Contributor guide

## Purpose

This repository is a therapist-facing clinic manager. Keep the product focused on private-practice administration: meetings, clients, fees, payments, recurring schedules, reminders, and monthly reporting.

## Non-negotiable boundaries

- The browser must communicate with the application through FastAPI only. Never add Supabase SDK usage, Supabase URLs, anon keys, service-role keys, or database queries to frontend code.
- Authentication is enforced by the backend with the HTTP-only auth cookie and `get_current_user`. Every user-owned API route must require that dependency.
- Never commit credentials, real domains, email addresses, or deployment-specific paths. Use environment variables and the templates in `deploy/`.
- Amounts are stored canonically in ILS. USD is a presentation/input preference, not a second source of truth.
- Do not edit `20261031044056_initial_schema.sql` or any migration that has already been pushed. Add a later timestamped migration.
- Keep the app therapist-facing; do not introduce client-facing accounts or public client data endpoints without an explicit product decision.

## Code organization

- Put API route groups in `backend/app/routers/`, not in `backend/main.py`.
- Put shared request/response models in `backend/app/schemas.py` and shared configuration/database behavior in `backend/app/`.
- Keep browser API calls in `frontend/js/api.js`, state/data helpers in `data.js`, formatting/currency in their dedicated modules, and page rendering in `views.js`/`main.js`.
- Use separate HTML pages for top-level tabs. Keep page-specific DOM binding defensive so a page does not fail because another page's element is absent.
- Use readable newlines and spacing. Prefer small named functions over large inline handlers.

## Recurrence and finance rules

- A recurring meeting is a definition row with a JSON recurrence rule, optional end date, and series ID.
- An exception is a separate meeting row tied to the series and exact occurrence date. Single-occurrence edits/deletions must not silently rewrite the entire series.
- A future-series edit ends the old row before the selected occurrence and creates a new series definition row.
- Monthly day `15` means the 15th day of every applicable month; the interval controls every N months.
- Completed meetings contribute to charged/owed totals. Scheduled meetings are anticipated only. Payment logs reduce the outstanding balance.

## Verification before handoff

```bash
python -m compileall -q backend
node --check frontend/js/api.js
node --check frontend/js/main.js
node --check frontend/js/views.js
git diff --check
```

For database changes, validate SQL with the Supabase CLI and test against a disposable/local project before pushing. For deployment changes, run `nginx -t` and inspect service status on the server.

## Deployment assumptions

Production uses `/var/www/clinic-manager` as a symlink to the editable checkout, Uvicorn on `127.0.0.1:8017`, Nginx for static files and `/api` proxying, and a separate reminder worker. The domain belongs in the server-only Nginx file and environment, never in tracked source.

See `docs/` for the full operational and feature documentation.
