# Monitoring evidence

`alerts.jsonl` contains a controlled failure drill for the Rust/Axum service
that previously completed a real Kite testnet payment. The same service first
produced three stable, policy-compliant 402 responses in
`reports/monitor-healthy-2026-09-24`. It was then stopped and the next monitor
run produced `pending`, `UNREACHABLE`, and a warning alert in
`reports/monitor-degraded-2026-09-24`.

The drill proves detection and alert generation. The scheduled workflow remains
disabled until the reviewed Vercel fixture is published to a persistent public
HTTPS URL and added to `data/admitted.jsonl`.
