# Kite x402 Service Evaluator

An auditable admission evaluator and continuous monitor for public x402
endpoints targeting the Kite ecosystem. It collects raw unpaid `402 Payment
Required` evidence, validates x402 v2 payment terms against a versioned policy,
and produces `pass`, `pending`, or `reject` recommendations with stable reason
codes.

Automated output is advisory. KiteAI maintainers retain the final admission
decision.

Public monitored service: <https://vercel-x402-service.vercel.app/v1/status>

## What it evaluates

For every candidate endpoint, the evaluator checks:

- Public HTTPS URL and `/v1/*` route shape.
- Stable HTTP 402 behavior across repeated probes.
- A decodable `PAYMENT-REQUIRED` header using x402 v2.
- The `exact` scheme, Kite network, settlement asset, payee, amount, timeout,
  and EIP-712 domain.
- Expected network and price declared by the candidate source.
- Evidence size limits and secret redaction.

The default policy supports Kite mainnet USDC.e (`eip155:2366`) and testnet
pieUSD (`eip155:2368`). The policy and price ceilings are explicit in
[`config/policy.json`](config/policy.json).

## Architecture

```text
candidate manifests / JSONL
           │
           ▼
      normalize + dedupe
           │
           ▼
  repeated unpaid 402 probes
           │
           ├── raw redacted evidence
           ▼
      admission policy
           │
           ├── pass
           ├── pending → manual review
           └── reject
           │
           ▼
 JSON + Markdown reports / monitor alerts
```

Paid execution is intentionally disabled in the baseline. Authorized payment
results can be recorded with `record-payment`; a future adapter must enforce
both per-call and per-run budgets before signing anything.

## Quick start

Requires Node.js 22 or newer.

```bash
npm install
npm run check
npm test
```

Start the local fixture server:

```bash
npm run example
```

In another terminal, evaluate the sample candidates:

```bash
npm start -- probe \
  --input data/candidates.example.jsonl \
  --policy config/policy.json \
  --out artifacts
```

Each run writes:

```text
artifacts/runs/<run-id>/
├── run.json
├── report.json
├── report.md
└── candidates/<candidate-id>/
    ├── candidate.json
    ├── probe.json
    └── decision.json
```

Runtime evidence is ignored by Git because public responses can be large or
sensitive. Curated, redacted evidence intended for a submission should be
copied into a dedicated committed report directory after review.

## Import official service manifests

The official [`kite-x402-services`](https://github.com/gokite-ai/kite-x402-services)
repository stores deployed services as `services/<name>/service.yaml`.

```bash
npm start -- ingest \
  --root /path/to/kite-x402-services/services \
  --out data/candidates.jsonl
```

Only deployed manifests with a `base_url` are imported. Endpoints are
normalized and deduplicated by HTTP method and URL.

## Import the public x402 Bazaar

The official Bazaar discovery API provides a sourced inventory of public x402
services. The importer resolves documented path/query examples, preserves POST
bodies, deduplicates requests, and records a SHA-256 hash for every catalog
page used as source evidence.

```bash
npm start -- discover \
  --endpoint https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources \
  --limit 200 \
  --out data/candidates.jsonl \
  --source reports/run-id/source.json
```

If the runtime cannot reach the API directly, download pages with `curl` and
use `discover-snapshots`. The committed 2026-09-24 inventory was generated
from 10 pages containing 200 unique HTTP endpoints.

## Replay and export evidence

Policy changes can be tested against saved responses without sending another
request to public services:

```bash
npm start -- replay \
  --source-run artifacts/runs/original-run \
  --policy config/policy.json \
  --out artifacts \
  --run-id reviewed-run

npm start -- export \
  --run artifacts/runs/reviewed-run \
  --out reports/reviewed-run
```

The export contains compact decisions, redacted raw 402 responses, summary
counts, and SHA-256 integrity hashes.

## Manual review

Record at least three manual reviews before submitting an admission report:

```bash
npm start -- review \
  --candidate example-service \
  --automated pending \
  --final pass \
  --reviewer eightyun \
  --rationale "Three manual retries returned stable 402 challenges" \
  --misjudgment "The first probe hit a transient timeout"
```

Reviews are append-only JSONL records in `reviews/reviews.jsonl`.

The final owner-reviewed register is in
[`reports/final-admission-2026-09-24`](reports/final-admission-2026-09-24). It
combines the 200-candidate catalog run with the public monitored service and
records 1 pass, 1 pending, and 199 reject recommendations.

## Payment audit records

After an explicitly authorized paid test, record the result without storing a
private key or payment signature:

```bash
npm start -- record-payment \
  --candidate example-service \
  --network eip155:2368 \
  --asset 0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A \
  --amount 1000000000000000 \
  --status success \
  --transaction 0xYOUR_TRANSACTION_HASH
```

This repository does not currently contain a successful paid-call audit for the
public monitored service. Kite Passport rejected both production and
development attempts before it generated a `PAYMENT-SIGNATURE` because
`vercel-x402-service.vercel.app` is not in the executable service catalog. The
request therefore never reached facilitator verification or settlement, no
transaction was created, and the approved 0.001 USD session budget spent zero.
The failed attempts and exact error are preserved in
[`payment-audits/vercel-catalog-gate-2026-09-24.json`](payment-audits/vercel-catalog-gate-2026-09-24.json).

To produce a successful paid-call audit for this service:

1. Kite must add `vercel-x402-service.vercel.app` to the Passport executable
   catalog or grant the hostname partner testing allowlist access.
2. Confirm an unpaid `GET /v1/status` still returns the expected Kite testnet
   x402 v2 challenge.
3. Approve a sandbox Passport session with a 0.001 USD per-transaction and total
   budget, then execute one paid request to that exact URL.
4. Preserve the HTTP 200 response, decoded `PAYMENT-RESPONSE`, transaction hash,
   network, asset, amount, payer, and payee without storing any signature or key.
5. Verify the transaction receipt through Kite testnet RPC or Kitescan and add
   the result with `record-payment`.

## Continuous monitoring

Use a curated list of admitted endpoints:

```bash
npm start -- monitor \
  --input data/admitted.jsonl \
  --policy config/policy.json \
  --out artifacts \
  --alerts alerts/alerts.jsonl \
  --fail-on-alert true
```

Any `pending` result creates a warning; any `reject` result creates a critical
alert record. `--fail-on-alert true` returns exit code 2 after preserving the
run evidence, so GitHub Actions reports the scheduled job as failed. The
included workflow probes the curated public service every six hours and always
uploads its evidence and alert files.

The public fixture is deployed from
[`deploy/vercel-x402-service`](deploy/vercel-x402-service). Its first committed
monitor run passed all three probes; see
[`reports/public-monitor-healthy-2026-09-24`](reports/public-monitor-healthy-2026-09-24).
The transport-failure run in
[`reports/public-monitor-alert-2026-09-24`](reports/public-monitor-alert-2026-09-24)
shows the corresponding warning path.

## 2026-09-24 evaluation evidence

The committed run evaluated 200 catalog candidates across 113 unique hosts with
600 probes. It captured 537 raw HTTP 402 responses. All 200 candidates were
rejected under the Kite policy: 179 advertised no supported Kite network, 172
also used a route outside `/v1/*`, 19 were unreachable, and 2 returned a stable
non-402 response. Reason counts overlap when a candidate violates more than one
rule.

Evidence is in [`reports/evaluation-2026-09-24`](reports/evaluation-2026-09-24),
manual reviews are in [`reviews/reviews.jsonl`](reviews/reviews.jsonl), and the
blocked paid-call attempts are in [`payment-audits`](payment-audits).
Repository-owner confirmation of all three reviews is recorded in
[`reviews/owner-signoff.json`](reviews/owner-signoff.json).

## Decision model

| Status | Meaning |
|---|---|
| `pass` | Every probe is stable and at least one payment option satisfies policy. |
| `pending` | The endpoint is unreachable or inconsistent and needs human review. |
| `reject` | A stable response violates an explicit admission rule. |

Common reason codes include `NO_402_RESPONSE`, `INVALID_PAYMENT_REQUIRED`,
`UNSUPPORTED_NETWORK`, `UNSUPPORTED_ASSET`, `PRICE_ABOVE_POLICY`,
`INVALID_EIP712_DOMAIN`, and `UNSTABLE_ENDPOINT`.

## Preparing the 200-endpoint evaluation

1. Import official Kite manifests.
2. Add other publicly documented x402 endpoints with a traceable `source`.
3. Deduplicate by method and normalized URL.
4. Commit only the candidate inventory, policy, curated reports, three or more
   manual reviews, payment audit summaries, and alert examples.
5. Keep raw runtime artifacts and all secrets out of Git.

See [`PLAN.md`](PLAN.md) for the implementation and acceptance mapping.

## Security and cost controls

- Authorization, cookies, payment signatures, and `Set-Cookie` are redacted.
- Response bodies are capped at 64 KiB by default.
- Redirects are not followed during admission probes.
- Public candidates must use HTTPS; loopback HTTP is allowed only for tests.
- Paid execution remains disabled until a reviewed budget-controlled adapter is
  implemented.
- Wallet private keys, API keys, and webhook URLs belong in environment
  variables and must never appear in evidence.

## License

Apache-2.0. See [LICENSE](LICENSE).
