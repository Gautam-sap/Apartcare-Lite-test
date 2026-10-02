# ApartCare Lite V6.5.13 — Production Trial Release

Target production domain: `www.apartcarelite.com`

## Production architecture
- Next.js frontend + FastAPI API in one Vercel deployment.
- Postgres (recommended: Neon through the Vercel Marketplace) is the authoritative persistent application state store.
- Private Vercel Blob stores apartment profile photos and expense receipts.
- Same-origin `/api/*` routing is used in production.
- Existing tenant_id authentication/isolation middleware remains active.

## Mandatory Vercel setup before creating client data
1. Import this project into Vercel from the ZIP/repository root.
2. Add a Postgres integration from Vercel Marketplace and ensure `DATABASE_URL` is available in Production.
3. Create a **Private** Vercel Blob store and connect it to the project so `BLOB_READ_WRITE_TOKEN` is injected.
4. Deploy.
5. Open `/api/health`. It must report:
   - `status: ok`
   - `version: 6.5.13`
   - `storage: postgres`
   - `production_ready: true`
6. Add `apartcarelite.com` and `www.apartcarelite.com` under Vercel Domains.
7. Configure DNS as instructed by Vercel.
8. Only after the health check passes, create the first Platform Owner and client accounts.

## Trial safety
If `DATABASE_URL` is missing on Vercel, all state-changing API requests are blocked with HTTP 503. This prevents accidental creation of client data in Vercel's ephemeral filesystem.

## Data safety
Do not upload a local `apartcare_state.json` into the deployment package. Production state belongs in Postgres.

## Current persistence model
V6.5.13 stores the application's existing state model as a JSONB document in Postgres. This preserves the current business logic while making the state durable for the initial client trial. It is intentionally a transition architecture; if client volume grows materially, the operational collections should be normalized into relational tables with row-level transactions.

## Uploaded files
Apartment photos and expense receipts use private Vercel Blob when `BLOB_READ_WRITE_TOKEN` is configured. Without Blob, local upload storage is available only for development; the production readiness check will not pass.

## Recommended trial test order
1. Platform Owner creation/login.
2. Create Client A.
3. Create Client B with overlapping Account Number/Flat numbers if desired to test tenant isolation.
4. Login A → Settings → Opening Balance → Maintenance.
5. Logout → Login B → verify A values never appear.
6. Platform Owner → Apartment Accounts → search and `All`.
7. User Recovery → reset Admin password.
8. Subscription/Trial settings.
9. Expense receipt upload and retrieval.
10. Data Import and Reports.
11. Mobile browser test.


## Security patch
Next.js updated to 15.5.26 for the production trial deployment.
