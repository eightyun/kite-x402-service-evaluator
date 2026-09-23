# Implementation plan

## Objective

Build an auditable admission evaluator for public x402 endpoints targeting the
Kite ecosystem. The tool produces recommendations; KiteAI maintainers retain
the final admission decision.

## Acceptance mapping

| Requirement | Repository support | Evidence still required |
|---|---|---|
| Evaluate at least 200 candidate endpoints | JSONL ingestion, bounded concurrency, immutable run artifacts | A sourced inventory and a completed run with at least 200 entries |
| Pass, pending, reject with reasons | Policy engine and stable reason codes | Curated final report |
| At least three manual reviews | Append-only review records with reviewer, timestamp, and rationale | Three real review records |
| Explain false positives or false negatives | `misjudgmentCause` on manual review records | A real disagreement or an explicit no-disagreement conclusion |
| Continuous monitoring and alerts | Monitor command, workflow, and append-only alert records | Reviewed admitted endpoints and an actual alert run |
| Evaluation report and raw 402 responses | Per-run JSON evidence plus JSON and Markdown reports | Redacted submission evidence from public endpoints |
| Payment audit records | Validated records with transaction hashes | Explicitly authorized real payment calls |
| Controllable and auditable spend | Paid execution disabled by default; policy contains future budget limits | A reviewed budget-controlled payment adapter before automation |

## Milestones

1. Repository scaffold, schemas, policy, CI, and mock endpoints.
2. Candidate ingestion and normalized deduplication.
3. Unpaid 402 probe, evidence capture, and policy evaluation.
4. Manual review and report generation.
5. Monitoring, baseline comparison, and alert records.
6. Budget-controlled real payment adapter and audit records.
7. Evaluate 200 public endpoints and manually review at least three results.

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
