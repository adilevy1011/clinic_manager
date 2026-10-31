# Stillpoint Clinic Manager

Therapist-facing meeting and fee manager. The frontend talks only to FastAPI; Supabase Auth, Postgres/RLS, and Resend are server-side integrations. Monetary amounts are stored canonically in ILS; each client and meeting also stores the last selected display/input currency (`ILS` or `USD`).

## Local run

1. Start Supabase locally and run `supabase db reset` to apply the initial schema.
2. Copy `backend/.env.example` to `backend/.env`, fill in Supabase and Resend values, then install dependencies with `python -m pip install -r backend/requirements.txt`.
3. Run the API: `uvicorn main:app --app-dir backend --reload --port 8017 --env-file backend/.env`.
4. Serve the frontend: `python -m http.server 3000 --directory frontend` and open http://localhost:3000.

The local page shows sample data when opened on port 3000. To exercise real login locally, set `window.ENABLE_PRODUCTION_AUTH = true` before `app.js` and use a backend configured with `FRONTEND_URL=http://localhost:3000`.

## DigitalOcean

Copy `deploy/clinic-manager.service` to `/etc/systemd/system/` and `deploy/clinic-manager.nginx.conf` to `/etc/nginx/sites-available/clinic-manager`; update `/var/www/clinic-manager` if you deploy elsewhere. Put backend secrets in `/var/www/clinic-manager/backend/.env`, enable the service and Nginx site, then run Certbot after DNS is live.

The included Nginx config serves the static frontend and proxies `/api` to Uvicorn on `127.0.0.1:8017`. Replace the placeholder `server_name _;` in the server-only Nginx copy with your own domain. The browser never receives a Supabase key. Use the Supabase anon key only in the backend environment; never use the service-role key in frontend code.
