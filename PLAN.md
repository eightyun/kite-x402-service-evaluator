# Implementation plan

## Objective

Build an auditable admission evaluator for public x402 endpoints targeting the
Kite ecosystem. The tool produces recommendations; KiteAI maintainers retain
the final admission decision.

## Acceptance mapping

| Requirement | Repository support | Evidence |
|---|---|---|
| Evaluate at least 200 candidate endpoints | JSONL ingestion, bounded concurrency, immutable run artifacts | 201 final records backed by 200 sourced catalog endpoints, 113 hosts, and 600 catalog probes |
| Pass, pending, reject with reasons | Policy engine and stable reason codes | Final register contains 1 pass, 1 pending, and 199 reject recommendations |
| At least three manual reviews | Append-only review records with reviewer, timestamp, and rationale | Three owner-confirmed records in `reviews` |
| Explain false positives or false negatives | `misjudgmentCause` on manual review records | Two documented causes; the aggregation defect was fixed and replayed |
| Continuous monitoring and alerts | Monitor command, six-hour workflow, exit-on-alert behavior, and append-only alerts | Public healthy run plus degraded and transport-alert runs |
| Evaluation report and raw 402 responses | Per-run JSON evidence plus JSON and Markdown reports | 537 redacted catalog responses and 3 public monitor responses with integrity hashes |
| Payment audit records | Validated records with transaction hashes | Blocked for the monitored service: Passport rejected the hostname before signing because it is absent from the executable catalog; no transaction exists |
| Controllable and auditable spend | Paid execution disabled by default; policy contains budget limits | Catalog-blocked attempts had a 0.001 USD per-transaction and total cap and spent zero |

## Milestones

1. Complete: repository scaffold, schemas, policy, CI, and mock endpoints.
2. Complete: candidate ingestion and normalized deduplication.
3. Complete: unpaid 402 probe, evidence capture, and policy evaluation.
4. Complete: owner-confirmed manual review and report generation.
5. Complete: public monitoring, scheduled checks, and alert records.
6. Blocked: explicitly authorized attempts were rejected before signing because
   the monitored hostname is not in the Passport executable catalog. Complete
   this milestone after catalog or allowlist access permits a real settlement.
7. Complete: 201 final endpoint records and three owner-confirmed manual reviews.

## Safety boundaries

- Never persist authorization headers, cookies, payment signatures, API keys,
  private keys, or full secrets in evidence.
- Do not automatically admit a service. Automated output is a recommendation.
- Do not execute paid requests unless the operator enables them explicitly and
  both per-call and per-run budgets permit the payment.
- Prefer testnet pieUSD for initial paid audits.

## Known risks

- Public endpoints may be unstable, rate-limited, or geographically filtered.
- A syntactically valid 402 response does not prove the upstream service is
  useful or legally resellable.
- Unpaid probes cannot prove settlement. Paid canaries remain separate and
  require explicit operator authorization.
- Large response bodies can leak data or exhaust storage, so evidence is
  redacted and capped.
