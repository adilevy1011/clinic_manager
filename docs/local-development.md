# Local development and testing

## Prerequisites

- Python 3.11 or newer is recommended.
- Node.js is useful for JavaScript syntax checks.
- A Supabase project or local Supabase CLI stack is needed for real login and data.

## Backend setup

From the repository root:

```bash
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Set the Supabase URL/key, Resend values, `FRONTEND_URL`, and `CORS_ORIGINS` in the private `.env`. Do not commit that file.

Run the API on the project port:

```bash
uvicorn main:app --app-dir backend --reload --port 8017 --env-file backend/.env
```

## Frontend setup

In a second terminal:

```bash
python -m http.server 3000 --directory frontend
```

Open `http://localhost:3000`. Use the real backend/auth configuration for end-to-end testing. Demo data is useful for layout work only and must not be considered a security mechanism.

## Database setup

For a local Supabase stack, start Supabase and apply migrations with `supabase db reset`. For an existing linked project, use `supabase db push`. Never edit an applied migration; create a new one.

## Checks

```bash
python -m compileall -q backend
node --check frontend/js/api.js
node --check frontend/js/main.js
node --check frontend/js/views.js
git diff --check
```

## Common issues

- A redirect to login usually means the backend URL, cookie, CORS origin, or Supabase auth configuration does not match the frontend origin.
- A 401 from an API route means the auth cookie is absent/expired; inspect the browser network request and `/api/auth/me`.
- A blank page after adding a tab usually means a page-specific element is being bound unconditionally. Guard optional elements in `main.js`.
- If reminders are saved but no email arrives, run the worker manually, inspect its environment, and check Resend sender/domain verification.
