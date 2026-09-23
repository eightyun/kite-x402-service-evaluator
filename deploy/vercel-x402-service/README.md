# Public monitoring fixture

This minimal Vercel function implements the same Kite x402 v2 payment contract
as the official wrapper templates. Unpaid `GET /v1/status` requests return a
Kite testnet `PAYMENT-REQUIRED` challenge. Paid requests are verified and
settled through the Pieverse facilitator before HTTP 200 is returned.

Public endpoint: <https://vercel-x402-service.vercel.app/v1/status>

The function holds no private key. `PAY_TO` is a public recipient address and
can be overridden as a Vercel environment variable.
