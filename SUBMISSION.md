# Acceptance evidence

Automated decisions are recommendations. KiteAI retains final admission
authority.

| Acceptance requirement | Evidence | Status |
|---|---|---|
| Evaluate at least 200 candidate endpoints | Catalog run plus `reports/final-admission-2026-09-24` | Complete: 201 final records; 200 catalog candidates, 113 hosts, 600 catalog probes |
| Pass, pending, reject with reasons | `reports/final-admission-2026-09-24/decisions.jsonl` | Complete: 1 pass, 1 pending, 199 reject with rationales and evidence references |
| At least three results manually reviewed | `reviews/reviews.jsonl`, `reviews/owner-signoff.json` | Complete: three conclusions confirmed by repository owner |
| Explain misjudgment causes | Two review records identify alternative-term aggregation and invalid catalog path input | Complete; aggregation bug fixed and replayed |
| Continuously monitor admitted services and alert | Public Vercel service, healthy/alert monitor evidence, six-hour GitHub Actions workflow | Complete |
| Evaluation report | Catalog report plus `reports/final-admission-2026-09-24` | Complete |
| Raw 402 responses | `reports/evaluation-2026-09-24/raw-402.jsonl` and integrity manifest | Complete: 537 redacted responses |
| Paid-call audit records | `payment-audits/audits.jsonl`, verified RPC receipt, and Vercel catalog-gate audit | Complete: successful 0.001 pieUSD settlement plus zero-spend blocked-host audit |
| Review conclusions and alert records | `reviews/reviews.jsonl`, `reviews/owner-signoff.json`, `alerts/alerts.jsonl` | Complete |
| Controlled, auditable spend | Automated payment disabled; successful audit spent 0.001 pieUSD; current-service attempts used a 0.001 total cap and spent zero | Complete |

## Material result

The first 200 public Bazaar candidates contained no service eligible for Kite
admission. This is a valid evaluation outcome, not a missing result: 179
candidates advertised networks other than `eip155:2366` or `eip155:2368`.
The final register adds the reviewed public monitoring fixture and applies the
owner-confirmed manual recommendation, producing 201 records: 1 pass, 1
pending, and 199 reject.

## Public monitored service

The reviewed fixture is publicly available at
<https://vercel-x402-service.vercel.app/v1/status>. Its source is in
`deploy/vercel-x402-service`, and its admission record is in
`data/admitted.jsonl`. The first successful public run recorded three stable
HTTP 402 responses and a `pass` decision in
`reports/public-monitor-healthy-2026-09-24`. The six-hour workflow fails on
`pending` or `reject` while retaining evidence as a workflow artifact.

## Paid-call scope

The successful paid audit used the related Rust/Axum Kite wrapper and records a
0.001 pieUSD transfer, HTTP 200 response, transaction hash, and independently
verified Kite RPC receipt. Passport rejected both production and development
attempts against the Vercel monitoring fixture before signing because its host
is not yet in the executable service catalog. The blocked attempts spent zero;
their error code and approved budget are recorded in
`payment-audits/vercel-catalog-gate-2026-09-24.json`. A same-service paid audit
requires Kite catalog registration or partner allowlist access.
