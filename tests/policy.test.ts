import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Candidate, HttpEvidence, Policy } from "../src/domain.js";
import { evaluateCandidate } from "../src/policy.js";

const policy = JSON.parse(await readFile("config/policy.json", "utf8")) as Policy;
const candidate: Candidate = {
  id: "test-service",
  method: "GET",
  url: "https://example.com/v1/data",
  source: "test",
  expectedNetwork: "eip155:2368",
  expectedPriceUsd: "0.001",
};

function evidence(challenge: object, attempt = 1): HttpEvidence {
  const body = JSON.stringify(challenge);
  return {
    attempt,
    observedAt: "2026-09-24T00:00:00.000Z",
    elapsedMs: 10,
    request: { method: "GET", url: candidate.url, headers: {} },
    response: {
      status: 402,
      headers: { "payment-required": Buffer.from(body).toString("base64") },
      body,
      bodyTruncated: false,
    },
  };
}

function challenge(amount = "1000000000000000"): object {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: "eip155:2368",
        amount,
        asset: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A",
        payTo: "0x1111111111111111111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: { name: "pieUSD", version: "1" },
      },
    ],
  };
}

test("accepts a stable Kite testnet challenge", () => {
  const result = evaluateCandidate(candidate, [evidence(challenge()), evidence(challenge(), 2)], policy);
  assert.equal(result.status, "pass");
  assert.deepEqual(result.reasonCodes, []);
});

test("rejects prices above policy", () => {
  const { expectedPriceUsd: _expectedPriceUsd, ...candidateWithoutExpectedPrice } = candidate;
  const result = evaluateCandidate(
    candidateWithoutExpectedPrice,
    [evidence(challenge("100000000000000000"))],
    policy,
  );
  assert.equal(result.status, "reject");
  assert.ok(result.reasonCodes.includes("PRICE_ABOVE_POLICY"));
});

test("marks inconsistent attempts pending", () => {
  const noPayment: HttpEvidence = {
    ...evidence(challenge(), 2),
    response: { status: 200, headers: {}, body: "ok", bodyTruncated: false },
  };
  const result = evaluateCandidate(candidate, [evidence(challenge()), noPayment], policy);
  assert.equal(result.status, "pending");
  assert.ok(result.reasonCodes.includes("UNSTABLE_ENDPOINT"));
});

test("rejects routes outside the Kite /v1 prefix", () => {
  const result = evaluateCandidate(
    { ...candidate, url: "https://example.com/api/data" },
    [evidence(challenge())],
    policy,
  );
  assert.equal(result.status, "reject");
  assert.ok(result.reasonCodes.includes("INVALID_ROUTE_PREFIX"));
});

test("reports reasons from the closest payment option", () => {
  const mixedChallenge = challenge() as { accepts: Array<Record<string, unknown>> };
  mixedChallenge.accepts = [
    { ...mixedChallenge.accepts[0], network: "eip155:8453" },
    { ...mixedChallenge.accepts[0], scheme: "batch-settlement", network: "eip155:8453" },
  ];
  const result = evaluateCandidate(candidate, [evidence(mixedChallenge)], policy);
  assert.equal(result.status, "reject");
  assert.ok(result.reasonCodes.includes("UNSUPPORTED_NETWORK"));
  assert.ok(!result.reasonCodes.includes("UNSUPPORTED_SCHEME"));
});
