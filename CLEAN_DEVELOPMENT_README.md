# ApartCare Lite V6.5.13 — Clean Development

This package is based on the V6.5.13 UI Alignment Fix 5 source and is intended as the clean baseline for local functional testing before another GitHub/Vercel deployment.

## What was cleaned/fixed

- Platform Owner creation button now submits the authentication form normally (`type="submit"`) instead of using a separate click path.
- Apartment Account creation now has an explicit busy state, HTTP error reporting, network-error handling, and incomplete-response validation.
- Local Next.js development proxies `/api/*` to FastAPI at `127.0.0.1:8000`, so the UI and backend can run separately without changing frontend API code.
- Local state is kept under `backend/runtime/apartcare_state.json` and can be reset with `RESET_CLEAN_DEV.bat`.
- Existing V6.5.13 tenant isolation, authentication, business calculations, and UI alignment rules are retained.

## Start locally on Windows

1. Open the `apartcare` folder.
2. Run `START_CLEAN_DEV.bat`.
3. Open `http://localhost:3000`.
4. First test **Create Platform Owner**.
5. Then test **Create Apartment Account**.
6. Confirm the backend health at `http://127.0.0.1:8000/health`.

## Reset to a virgin test state

Run `RESET_CLEAN_DEV.bat`, then restart the development servers.

## Important for Vercel

This clean development package does **not** remove the production persistence requirement. The backend intentionally refuses state-changing production requests when Vercel has no `DATABASE_URL`. Vercel serverless instances cannot use the local JSON file as durable client storage.

Before client trial deployment, configure the production Postgres `DATABASE_URL` in Vercel for Production/Preview as appropriate, then deploy the `apartcare` directory as the Root Directory. Vercel supports deploying an application located in a repository subdirectory by setting the project's Root Directory accordingly.
