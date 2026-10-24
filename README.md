# Pulse Check

Live QR quiz for Omni Pulse Tech 2026. Static pages + Vercel serverless functions + PostgreSQL.

## Deploy
1. Import this repository into Vercel: https://vercel.com/new
2. Framework preset: Other; no build command; output directory: `public`.
3. Connect a PostgreSQL database and set `DATABASE_URL` (or `POSTGRES_URL`).
4. Add `HOST_PIN` as an environment variable.
5. Deploy and open `/host`.

Tables and the question bank are initialized automatically on first use. See project source and `.env.example` for configuration.
