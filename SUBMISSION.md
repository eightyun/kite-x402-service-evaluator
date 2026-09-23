# Acceptance evidence

Automated decisions are recommendations. KiteAI retains final admission
authority.

| Acceptance requirement | Evidence | Status |
|---|---|---|
| Evaluate at least 200 candidate endpoints | `data/candidates-2026-09-24.jsonl`, `reports/evaluation-2026-09-24/source.json`, `summary.json` | Complete: 200 candidates, 113 hosts, 600 probes |
| Pass, pending, reject with reasons | Policy engine, reason codes, full decision JSONL, healthy and degraded monitor runs | Complete |
| At least three results manually reviewed | `reviews/reviews.jsonl` | Technical reviews complete; repository owner sign-off required |
| Explain misjudgment causes | Two review records identify alternative-term aggregation and invalid catalog path input | Complete; aggregation bug fixed and replayed |
| Continuously monitor admitted services and alert | Healthy/degraded monitor evidence and GitHub Actions workflow | Controlled drill complete; persistent deployment pending |
| Evaluation report | `reports/evaluation-2026-09-24/evaluation-report.{md,json}` | Complete |
| Raw 402 responses | `reports/evaluation-2026-09-24/raw-402.jsonl` and integrity manifest | Complete: 537 redacted responses |
| Paid-call audit records | `payment-audits/audits.jsonl` and verified RPC receipt | Complete: successful 0.001 pieUSD settlement |
| Review conclusions and alert records | `reviews/reviews.jsonl`, `alerts/alerts.jsonl` | Complete for the controlled run |
| Controlled, auditable spend | Paid execution disabled in evaluator; real payment was 0.001 pieUSD and independently verified through Kite RPC | Complete |

## Material result

The first 200 public Bazaar candidates contained no service eligible for Kite
admission. This is a valid evaluation outcome, not a missing result: 179
candidates advertised networks other than `eip155:2366` or `eip155:2368`.

## Remaining external action

Publish the reviewed service in `deploy/vercel-x402-service`, add its public
`/v1/status` URL to `data/admitted.jsonl`, enable the six-hour schedule, and
record one public monitor run. Uploading that source to Vercel requires explicit
repository-owner authorization.
