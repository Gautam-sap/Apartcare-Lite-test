# ApartCare Lite V6.5.13 — Deployment Checklist

## Vercel project

1. Create/link a Vercel project using this ZIP's root folder.
2. Do **not** set the project root to `app/`, `frontend/`, or `backend/`.
3. Keep the project root exactly where `package.json`, `pyproject.toml`, `app/`, and `api/` are siblings.
4. Deploy with the current Vercel CLI or import the repository in Vercel.

## Domain

Add:

- `www.apartcarelite.com`
- `apartcarelite.com`

Use the DNS records Vercel provides for the domain. The application itself does not hard-code a deployment hostname.

## Environment

Set:

```text
NEXT_PUBLIC_API_BASE=
CORS_ALLOWED_ORIGINS=https://www.apartcarelite.com,https://apartcarelite.com
```

Leave `NEXT_PUBLIC_API_BASE` empty because frontend and FastAPI share the same origin.

## First deployment smoke tests

Check:

- `/` loads ApartCare Lite.
- `/api/account/status` responds.
- Platform Owner login page loads.
- Property login page loads.
- Browser Network requests use `https://www.apartcarelite.com/api/...`, not `localhost:8000`.
- No old `V6.5.1 SaaS` badge is displayed.
- Checkbox controls remain 16x16.

## Production data warning

The current V6.5.13 application uses a JSON state engine. Vercel function-local storage is not durable. This clean package deliberately excludes any local `apartcare_state.json` and does not pretend that `/tmp` is a production database.

Before creating real tenant data on the live domain, connect the application's state engine to durable production storage. This is especially important for tenant accounts, passwords, settings, payments, expenses, locks, audit history and subscription data.
