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
| Paid-call audit records | `payment-audits/audits.jsonl` and `payment-audits/vercel-catalog-gate-2026-09-24.json` | Blocked: no successful paid call; Passport rejected the hostname before signing because it is absent from the executable catalog |
| Review conclusions and alert records | `reviews/reviews.jsonl`, `reviews/owner-signoff.json`, `alerts/alerts.jsonl` | Complete |
| Controlled, auditable spend | Automated payment disabled; attempts used a 0.001 USD per-transaction and total cap and spent zero | Complete |

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

## Paid-call status

There is no successful paid-call audit for the public monitored service.
Passport rejected both production and development attempts before signing with
`payment_target_forbidden` / `host_not_in_executable_catalog`. Consequently,
the service received no `PAYMENT-SIGNATURE`, the facilitator was not called,
there is no settlement transaction or HTTP 200 paid response, and observed
spend remained zero. The exact attempts and approved 0.001 USD budget are in
`payment-audits/vercel-catalog-gate-2026-09-24.json`.

A valid paid-call audit can be produced only after Kite adds
`vercel-x402-service.vercel.app` to the Passport executable catalog or grants
partner testing allowlist access. After access is granted, the audit procedure
is: approve a tightly bounded sandbox session; execute one paid
`GET https://vercel-x402-service.vercel.app/v1/status`; preserve the HTTP 200
response and decoded `PAYMENT-RESPONSE`; verify the transaction hash, network,
asset, amount, payer, and payee through Kite testnet RPC or Kitescan; then add
the verified result with the repository's `record-payment` command. Private
keys and payment signatures must not be stored.
