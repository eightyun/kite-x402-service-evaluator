import assert from "node:assert/strict";
import test from "node:test";
import handler from "../deploy/vercel-x402-service/api/status.js";

test("public fixture returns a compliant Kite challenge without payment", async () => {
  let status = 0;
  let body: unknown;
  const headers: Record<string, string> = {};
  const response = {
    status(value: number) {
      status = value;
      return { json(value: unknown) { body = value; } };
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    json(value: unknown) {
      body = value;
    },
  };
  await handler(
    { method: "GET", headers: { host: "fixture.example.com", "x-forwarded-host": "fixture.example.com" } },
    response,
  );
  assert.equal(status, 402);
  const challenge = JSON.parse(Buffer.from(headers["payment-required"]!, "base64").toString("utf8"));
  assert.equal(challenge.x402Version, 2);
  assert.equal(challenge.resource.url, "https://fixture.example.com/v1/status");
  assert.equal(challenge.accepts[0].network, "eip155:2368");
  assert.equal(challenge.accepts[0].amount, "1000000000000000");
  assert.deepEqual(body, challenge);
});
