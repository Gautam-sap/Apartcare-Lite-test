# ApartCare Lite V6.5.13 — Clean Vercel Deployment

Target domain: https://www.apartcarelite.com

## Project structure

- `app/` — Next.js frontend
- `api/index.py` — Vercel FastAPI entrypoint
- `backend/app/main.py` — ApartCare Lite API
- `public/apartcare-lite-logo.png` — application branding

## Local deployment check

Use Node.js 20+ and Python 3.13.

```bash
npm install
npm run build
python -m pip install -r requirements.txt
```

For direct local Next.js + FastAPI development, set:

```text
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

For Vercel same-origin deployment, leave `NEXT_PUBLIC_API_BASE` empty. The frontend calls `/api/...` on the same domain.

## Vercel

Deploy this folder as the Vercel project root. The Vercel Root Directory should be **`.` (repository root)** when these folders are at repository root. If the entire package is intentionally placed under a `Preprod/` folder, then use **`Preprod`** as the Vercel Root Directory. Do not point Vercel at a nested `app/` or `backend/` folder. Vercel serves Next.js at `/` and the FastAPI app through `/api/*` using `api/index.py`.

Recommended environment variables:

- `NEXT_PUBLIC_API_BASE` = empty
- `CORS_ALLOWED_ORIGINS` = `https://www.apartcarelite.com,https://apartcarelite.com`
- Razorpay variables only if billing is enabled

After the first deployment, add both custom domains in Vercel:

- `www.apartcarelite.com`
- `apartcarelite.com`

## IMPORTANT — persistent data

V6.5.13's existing application engine persists its state to a JSON file. Vercel Functions do not provide durable application-local filesystem storage. The deployment package therefore does **not** contain `apartcare_state.json`, and on Vercel the runtime fallback is `/tmp/apartcare`.

Do not create production tenant data on Vercel until a persistent database/storage layer is connected. `/tmp` can disappear when a function instance is replaced and is not a substitute for durable storage.

The tenant-isolation, calculation, locking and UI code is preserved; this deployment package is a hosting/packaging cleanup and does not silently convert the JSON data engine into a database.

## Production trial persistence (V6.5.13)
For production/trial use, connect a Postgres database through the Vercel Marketplace (Neon is a supported native integration). Set `DATABASE_URL` in the Vercel Production environment. The backend uses Postgres JSONB for durable application state instead of Vercel's ephemeral filesystem. Do not deploy real tenant data without a configured DATABASE_URL.

The current release still uses the local `/uploads` filesystem for uploaded receipts/photos. For a production rollout that requires durable uploaded documents across function instances, connect Vercel Blob (preferably private) and migrate the upload endpoints before relying on document retention.

### Required production resources
1. Install a Postgres integration from the Vercel Marketplace (Neon is a supported option) and ensure `DATABASE_URL` is present in Production.
2. Create a **Private** Vercel Blob store and connect it to the project so `BLOB_READ_WRITE_TOKEN` is injected. V6.5.13 uses Blob for uploaded apartment photos and expense receipts when this variable is present.
3. Do not use the local JSON state file in production.
4. Verify `/api/health` reports `storage: postgres` and `production_ready: true` before creating client accounts.
