# GPT-powered Intelligent Dashboard — Preview Setup

This feature is isolated on the `feature/gpt-intelligent-dashboard` branch. It adds a read-only interactive dashboard panel and a Vercel serverless endpoint. It does not add tables, alter Supabase schema, or expose inventory posting actions.

## Required Vercel Preview environment variable

Add `OPENAI_API_KEY` to **Preview** environment variables only for the first test. Keep it out of GitHub and all browser files. The endpoint defaults to `gpt-6-astra`; optionally set `OPENAI_MODEL` if your OpenAI project uses a different available model. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` only if you want to override the public project settings already used by the app.

After setting the key, redeploy the preview branch.

## What is included

- Dashboard-only interactive stock/expiry watchlist with All, Expiry, Low Stock and Out of Stock filters.
- KPI cards based on the existing browser-loaded Supabase views.
- Quick prompts for daily priorities, expiry, replenishment and stock health.
- Authenticated AI assistant endpoint that verifies the Supabase session and active app account.
- Read-only, bounded inventory snapshot; no SQL writes, RPC posting calls, schema changes or automatic transaction actions.
- API key remains server-side; API responses are not cached and Responses API storage is disabled.

## Preview test checklist

1. Sign in with an active bakery inventory account.
2. Open Dashboard; verify existing charts, filters and cards still appear.
3. Filter the watchlist and check mobile layout.
4. Ask “Summarize the most important inventory risks” and verify the answer distinguishes snapshot facts from recommendations.
5. Test signed-out requests (must return 401) and missing API key behavior (clear 503 message).
6. Confirm receiving, transfer, waste, and adjustment records remain unchanged.
7. Test the deployed preview on Android and the installed PWA; update the service worker cache version if the preview is installed separately.

Do not merge into `main` or deploy to production until the preview is reviewed and the owner approves it.
