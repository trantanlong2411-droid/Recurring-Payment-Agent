# Recurring Payment Agent — challenge evidence

**Task:** Pharos Agent Arena / Medium / Payments / Recurring Payment Agent

- **Public website / intended submission proof:** https://recurring-payment-agent.trantanlong2411.workers.dev/
- **Source repository:** https://github.com/trantanlong2411-droid/Recurring-Payment-Agent
- **Unit + build workflow:** https://github.com/trantanlong2411-droid/Recurring-Payment-Agent/actions/workflows/verify.yml
- **Deployed end-to-end workflow:** https://github.com/trantanlong2411-droid/Recurring-Payment-Agent/actions/workflows/verify-deployed.yml

## Rubric mapping

1. **Weekly/monthly with amount, token, recipient:** typed validated settings are stored in an independent SQLite Durable Object. UTC cadence preserves the original month anchor day. The dashboard shows a confidential capability key.
2. **Prepare on schedule and track paid/pending/failed:** a durable alarm (independent of open browser tabs) creates a **PENDING** unsigned template on each due timestamp. User review with actual Pharos RPC balances and gas yields READY or FAILED. After external wallet signing, submitted transaction hashes are tracked as SUBMITTED, PAID only if exact confirmed receipt and transfer event matches; reverted receipts become FAILED.
3. **Insufficient balance / transaction failure without double-paying:** insufficient USDC/PROS blocks unsigned preparation. Retry reuses the same period. Unique due timestamps and a single active hash per period prevent duplicate entries, and submission of the same hash is idempotent.
4. **Payment history and next scheduled payment:** dashboard and JSON status response expose full UTC history, statuses, reasons, and nextDueAt.

## Testing and integrity

The program **never signs or broadcasts** and cannot move funds by itself. The UI uses a **third-party public sender address** solely to verify read-only balances and demonstrate an unsigned template. This is not ownership authorization, a transfer receipt, or an automatic payment service.

The unit suite covers weekly/monthly recurrence, end-of-month behavior, at-least-once alarms, unique due periods, exact ERC20 calldata, zero signing, and strict receipt validation that refuses false PAID outcomes.

The end-to-end GitHub Actions workflow is designed to test the actual deployed Worker: create a quick first due schedule, check one PENDING slot, call real USDC balance review, verify a 1 USDC unsigned transfer, confirm a fake/unmined tx hash is not PAID, and test an unfunded monthly schedule entering FAILED and retrying without creating duplicates.

**Do not claim that deployed Worker verification succeeded until GitHub Actions shows its live job as successful.** GitHub unit/build passing alone does not prove the Cloudflare binding and alarm deployment is running.

## Platform and security limitations

- Durable Object alarms are delivered **at least once**, not exactly once; our code deduplicates by the period key.
- Automatically **prepares unsigned transactions**, not automatically sends money. Requires a wallet owner's external signature.
- PAID is never inferred from an arbitrary hash, only a verified matching on-chain transaction.
- Global double-spend prevention across independent external wallets and multiple schedules is not possible without an on-chain idempotency contract.
- The private schedule key is a bearer capability and must remain secret. There is no identity/login service.
- Example third-party addresses and balances change over time.

Technical references: [Cloudflare Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/), [Cloudflare SQLite DO](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/), [Pharos Mainnet docs](https://docs.pharos.xyz/getting-started/network), [Circle USDC on Pharos](https://www.circle.com/multi-chain-usdc/pharos).
