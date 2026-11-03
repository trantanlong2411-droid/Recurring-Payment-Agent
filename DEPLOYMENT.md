# Cloudflare deployment checks for Recurring Payment Agent

> **Resolved:** Cloudflare Workers Builds has deployed the linked repository. A full deployed-Worker test successfully created a due period and unsigned USDC draft on Pharos Mainnet on 3 November 2026. [Successful end-to-end evidence](https://github.com/trantanlong2411-droid/Recurring-Payment-Agent/actions/runs/41683036544). The former `Hello world` response was an older pre-deployment state; the configuration below is only for troubleshooting future deployments.


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
