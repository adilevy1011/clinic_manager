# Stillpoint Clinic Manager

Therapist-facing meeting and fee manager. The frontend talks only to FastAPI; Supabase Auth, Postgres/RLS, and Resend are server-side integrations. Monetary amounts are stored canonically in ILS; each client and meeting also stores the last selected display/input currency (`ILS` or `USD`).

## Local run

1. Start Supabase locally and run `supabase db reset` to apply the initial schema.
2. Copy `backend/.env.example` to `backend/.env`, fill in Supabase and Resend values, then install dependencies with `python -m pip install -r backend/requirements.txt`.
3. Run the API: `uvicorn main:app --app-dir backend --reload --port 8017 --env-file backend/.env`.
4. Serve the frontend: `python -m http.server 3000 --directory frontend` and open http://localhost:3000.

The local page shows sample data when opened on port 3000. To exercise real login locally, set `window.ENABLE_PRODUCTION_AUTH = true` before `app.js` and use a backend configured with `FRONTEND_URL=http://localhost:3000`.

The client payment ledger is added by the later `20261031055000_client_payments.sql` migration. On an existing Supabase project, run `supabase db push` after pulling this change; do not modify the already-applied initial migration.

## DigitalOcean

Copy `deploy/clinic-manager.service` to `/etc/systemd/system/` and `deploy/clinic-manager.nginx.conf` to `/etc/nginx/sites-available/clinic-manager`; update `/var/www/clinic-manager` if you deploy elsewhere. Put backend secrets in `/var/www/clinic-manager/backend/.env`, enable the service and Nginx site, then run Certbot after DNS is live.

The included Nginx config serves the static frontend and proxies `/api` to Uvicorn on `127.0.0.1:8017`. It serves the separate `today.html`, `calendar.html`, `sessions.html`, `clients.html`, `reminders.html`, and `settings.html` pages at extensionless URLs such as `/calendar`. Replace the placeholder `server_name _;` in the server-only Nginx copy with your own domain. The browser never receives a Supabase key. Use the Supabase anon key only in the backend environment; never use the service-role key in frontend code.

To install the updated Nginx configuration on the droplet:

```bash
sudo cp /var/www/clinic-manager/deploy/clinic-manager.nginx.conf /etc/nginx/sites-available/clinic-manager
sudo ln -sfn /etc/nginx/sites-available/clinic-manager /etc/nginx/sites-enabled/clinic-manager
sudo nginx -t
sudo systemctl reload nginx
```

The `try_files $uri $uri/ $uri.html /today.html;` rule keeps URLs such as `/calendar` and `/settings` extensionless while serving their matching HTML files.

The reminder delivery worker is separate from Uvicorn. On the droplet, add `SUPABASE_SERVICE_ROLE_KEY` to the private backend environment file, then install and enable `deploy/clinic-manager-reminder-worker.service` alongside the API service. The service-role key is server-only and must never be committed or exposed to the frontend.
