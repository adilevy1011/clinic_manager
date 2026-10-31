# DigitalOcean deployment

## Directory layout

Keep the editable Git checkout in a convenient directory and expose it to services through a symlink:

```text
/root/clinic_manager                 editable checkout
/var/www/clinic-manager              symlink to the checkout
/var/www/clinic-manager/.venv        production virtual environment
```

The systemd and Nginx templates use `/var/www/clinic-manager`. If the checkout lives elsewhere, update the service/template paths on the server rather than hardcoding the server's domain into Git.

## Install/update

```bash
cd /root/clinic_manager
git pull --ff-only
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
sudo cp deploy/clinic-manager.service /etc/systemd/system/clinic-manager.service
sudo cp deploy/clinic-manager-reminder-worker.service /etc/systemd/system/clinic-manager-reminder-worker.service
sudo systemctl daemon-reload
```

Store production secrets in `/var/www/clinic-manager/backend/.env` with restrictive permissions. The file must contain Supabase, Resend, frontend URL, and CORS settings; add the service-role key for the reminder worker only.

## Nginx

Copy the template to `sites-available`, replace `server_name _;` with the domain configured in your DNS, then enable it:

```bash
sudo cp deploy/clinic-manager.nginx.conf /etc/nginx/sites-available/clinic-manager
sudo ln -sfn /etc/nginx/sites-available/clinic-manager /etc/nginx/sites-enabled/clinic-manager
sudo nginx -t
sudo systemctl reload nginx
```

The `try_files $uri $uri/ $uri.html /index.html;` rule removes `.html` from normal page URLs and sends unknown frontend paths to the landing page. The API remains under `/api/` and is proxied to `127.0.0.1:8017`.

## Start services

```bash
sudo systemctl enable --now clinic-manager
sudo systemctl enable --now clinic-manager-reminder-worker
sudo systemctl status clinic-manager --no-pager
sudo systemctl status clinic-manager-reminder-worker --no-pager
```

Check logs with `journalctl -u clinic-manager -f` and `journalctl -u clinic-manager-reminder-worker -f`. Verify `curl http://127.0.0.1:8017/health` before debugging Nginx.

## TLS and upgrades

After DNS points at the droplet, obtain TLS with Certbot for the real domain. During an upgrade, pull code, install dependencies, push migrations, run syntax checks, then restart the API and worker. Keep the previous commit available so the symlinked checkout can be rolled back safely if needed.

Do not expose Uvicorn publicly, commit `.env`, or put the service-role key in frontend files.
