# Cloudflare deployment checks for Recurring Payment Agent

> **Actual blocker observed on 3 Nov 2026:** The expected Worker returned the literal plain-text response `Hello world` at `/api/health`, rather than the new JSON health response. The [deployed live workflow](https://github.com/trantanlong2411-droid/Recurring-Payment-Agent/actions/runs/41680735534) retried 34 times and then correctly failed with `Published Worker did not match deployed build`. This shows the new Worker code has **not** been deployed to that URL. This is separate from the successful GitHub unit tests and Worker bundle. Follow the Cloudflare Builds steps below.


The source is in [GitHub](https://github.com/trantanlong2411-droid/Recurring-Payment-Agent), with a compiled Cloudflare Worker and a SQLite-backed Durable Object named `PaymentSchedule`.

## Expected public Worker

- https://recurring-payment-agent.trantanlong2411.workers.dev/
- https://recurring-payment-agent.trantanlong2411.workers.dev/api/health

The health endpoint should return JSON with `ok:true`, `version:"recurring-pharos-2026-11-03-v1"`, `chainId:1672`, `storage:"SQLite Durable Object with alarms"`, and `signing:false`/`broadcast:false`.

## If website is not published

1. Cloudflare Dashboard → Workers & Pages → existing **Recurring Payment Agent** Worker → Settings → Builds.
2. Confirm its GitHub repository is **trantanlong2411-droid/Recurring-Payment-Agent** and production branch **main**, root directory `/`.
3. Confirm the actual Worker name is `recurring-payment-agent` (the same as `name` in `wrangler.jsonc`); otherwise update the Wrangler Worker name accordingly before deployment.
4. Build command: `npm install` (or default allowed by your build settings). **Deploy command must be `npx wrangler deploy`**, not `npm run build`, which runs a dry run in CI.
5. Check that `wrangler.jsonc` includes the `SCHEDULES` Durable Object binding and the `new_sqlite_classes` migration for `PaymentSchedule`. Cloudflare creates the SQLite DO namespace on deployment automatically; do not create a separate D1 database for this.
6. Trigger production deploy from the dashboard, then check the actual URL shown by Cloudflare and confirm `/api/health`.
7. Open the site, create a 20-second demo schedule and verify exactly one PENDING period. Review the unsigned transaction without ever signing or sending an actual transfer.
8. Re-run the [deployed workflow](https://github.com/trantanlong2411-droid/Recurring-Payment-Agent/actions/workflows/verify-deployed.yml) to produce actual reviewer evidence.

## Local deployment alternative (only from an authenticated Cloudflare account)

```sh
git clone https://github.com/trantanlong2411-droid/Recurring-Payment-Agent.git
cd Recurring-Payment-Agent
npm install
npm test
npx wrangler login
npx wrangler deploy
```

Use the **exact** `workers.dev` URL from the deploy output; never invent a public endpoint. If different, configure `RECURRING_AGENT_URL` when running `node scripts/smoke-deployed.mjs`.

Never expose wallet private keys, account recovery phrases, Cloudflare API tokens or the schedule access capability. The Worker itself never signs or broadcasts payments.

Official reference: https://developers.cloudflare.com/durable-objects/api/alarms/ and https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/
