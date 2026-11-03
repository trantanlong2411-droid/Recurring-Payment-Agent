---
name: pharos-recurring-payment-agent
description: Read-only Pharos recurring USDC or PROS scheduled payment preparation with durable UTC alarms, persisted history, safe retries, and on-chain receipt verification.
---
# Recurring Payment Agent — Pharos Season of AI

## Objective

Implement the four Medium / Payments challenge criteria: a configurable weekly or monthly payment; creation of each due unsigned instruction and paid/pending/failed tracking; insufficient balance and transaction failure management without generating duplicate period instructions; persistent payment history and next scheduled payment.

## Required agent procedure

1. Capture the sender public EVM address, recipient public EVM address, amount, asset (Circle USDC or native PROS), UTC first due timestamp, description and weekly/monthly cadence. Never require private keys.
2. Validate both addresses, prohibit zero/self-transfers, validate exact decimal precision and supported mainnet contract, and reject backdated/absurd future starts.
3. Generate a secure unpredictable UUIDv4 in the user browser as a private schedule capability, then write the schedule to SQLite-backed Cloudflare Durable Object storage.
4. Set the Durable Object alarm for the next due timestamp; at the due event, generate **one unique PENDING period**, with the encoded **unsigned** transaction template. Persist its due timestamp, status and creation time, then schedule the next alarm. Alarms are **at least once**; deduplicate by due date.
5. On user review, query fixed Pharos Pacific Mainnet RPC (1672) for current token contract, symbol and decimals, sender balance, native PROS gas balance, estimateGas and nonce. Return a READY unsigned transaction only when every check passes. Otherwise label FAILED and provide an explicit retry.
6. Do **not** sign or broadcast a payment. The person controlling the sending wallet must review and sign externally. Their external transaction hash may be submitted as SUBMITTED, **never Paid immediately**.
7. Verify a Paid status only after the exact Pharos transaction hash is mined successfully with sufficient confirmations, and matches sender, destination, encoded calldata and amount. For USDC also require an exact matching ERC-20 Transfer event in the receipt. A reverted transaction is FAILED, not Paid.
8. Never accept a second hash on an already submitted or paid period. Duplicate submissions of the same hash are idempotent. Keep one period per unique due timestamp. An insufficient balance can be retried without creating a second period.
9. Display the entire UTC payment history and nextDueAt in the dashboard. Support pause, resume and cancel without deleting old receipts.
10. Run unit tests and Cloudflare Worker build. Test a new 20-second due schedule on the deployed Worker and verify one actual PENDING period, a real funded mainnet unsigned USDC review, an unfunded FAILED scenario, retry and an unknown hash remaining SUBMITTED. Only after independently successful live checks should the application be described as ready for reviewer submission.

## Integrity and limitations

- The program only **prepares drafts** automatically on schedule. It is not unattended payment authorization, wallet transfer automation or a custodial payment service.
- No cron server or browser must remain open: a Durable Object alarm wakes up on a future timestamp, but execution may be slightly delayed during service interruptions.
- No on-chain recurring contract is deployed. The system guarantees **local period idempotency**, not prevention of extra transfers signed independently in an unrelated external wallet or cross-schedule double-use.
- No signatures, seed phrases or private keys are stored or requested.
- User schedule access key is a bearer capability and must not be shared with other users or reviewers.
- Never use mock evidence as a real paid receipt, and never claim real funds moved to create the proof.
