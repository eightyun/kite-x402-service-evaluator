# Kite x402 Service Evaluator

An auditable admission evaluator and continuous monitor for public x402
endpoints targeting the Kite ecosystem. It collects raw unpaid `402 Payment
Required` evidence, validates x402 v2 payment terms against a versioned policy,
and produces `pass`, `pending`, or `reject` recommendations with stable reason
codes.

Automated output is advisory. KiteAI maintainers retain the final admission
decision.

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

## Continuous monitoring

Use a curated list of admitted endpoints:

```bash
npm start -- monitor \
  --input data/admitted.jsonl \
  --policy config/policy.json \
  --out artifacts \
  --alerts alerts/alerts.jsonl
```

Any `pending` result creates a warning; any `reject` result creates a critical
alert record. The included scheduled workflow is disabled until a real admitted
candidate file is committed, preventing noisy or misleading monitoring.

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
