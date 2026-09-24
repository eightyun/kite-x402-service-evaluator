# Final x402 admission register

- Candidates: 201
- Pass: 1
- Pending: 1
- Reject: 199

| Final status | Candidate | Rationale | Evidence |
|---|---|---|---|
| pass | kite-x402-monitor-fixture | Public Kite testnet challenge passed three repeated probes. | reports/public-monitor-healthy-2026-09-24 |
| pending | intel-twzrd-xyz-get--v1-intel-quick-solana-20wallet-20address-20-base58-encoded-20pu-81a0334c73 | Catalog path contains a schema description instead of a concrete Solana address; reprobe with valid input is required. | reports/evaluation-2026-09-24 and reviews/reviews.jsonl |
| reject | 199 catalog candidates | Stable evidence violated one or more explicit Kite admission rules. | reports/evaluation-2026-09-24 |

The complete 201-record decision register is in `decisions.jsonl`. Automated results are recommendations; KiteAI retains final admission authority.
