# Architecture

## Responsibilities

The project has three runtime pieces:

1. The static frontend serves HTML, CSS, and browser JavaScript. It renders pages and calls JSON endpoints; it has no database credentials.
2. FastAPI exposes authenticated API routes, validates input, calls Supabase Auth/PostgREST, expands recurring meetings, and calculates summaries.
3. The reminder worker periodically queries due reminders with the server-only Supabase service-role key and sends email through Resend.

The worker is separate from Uvicorn. A slow or unavailable email provider should not block normal page requests.

## Request flow

1. The user opens an extensionless page through Nginx.
2. The browser calls `/api/auth/me` using the same-origin HTTP-only cookie.
3. FastAPI validates the Supabase access token and obtains the authenticated user ID.
4. Route handlers query only records belonging to that user. The authenticated PostgREST client uses the user's bearer token so database RLS remains relevant.
5. The frontend renders the returned data and never receives Supabase credentials.

## Backend modules

- `backend/main.py`: app creation, middleware, router registration, and health endpoint.
- `backend/app/config.py`: environment-backed settings.
- `backend/app/db.py`: authenticated and service-role PostgREST clients.
- `backend/app/dependencies.py`: auth/user dependencies.
- `backend/app/schemas.py`: Pydantic request and response models.
- `backend/app/routers/`: route groups for auth, users, clients, meetings, payments, finance, rates, reminders, and email.

## Frontend pages

`index.html` is the authenticated landing page and `login.html` is the sign-in page. Other top-level pages are `calendar.html`, `sessions.html`, `clients.html`, `money.html`, `reminders.html`, and `settings.html`; `client.html` is the client detail page. `frontend/js/main.js` chooses behavior from the current page and `views.js` owns markup rendering.

## URL and proxy model

Nginx serves `/calendar` from `calendar.html`, `/login` from `login.html`, `/money` from `money.html`, and so on using `try_files`; unknown frontend paths fall back to `/index.html`. `/api/` and `/health` are proxied to Uvicorn on port 8017. Keep the public domain and TLS configuration outside tracked source.
