import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBazaarItem } from "../src/bazaar.js";

test("normalizes Bazaar path, query, body, and payment metadata", () => {
  const candidate = normalizeBazaarItem(
    {
      type: "http",
      resource: "https://api.example.com/tools/:tool",
      lastUpdated: "2026-09-24T00:00:00.000Z",
      accepts: [{ network: "eip155:8453", asset: "0x1111111111111111111111111111111111111111" }],
      extensions: {
        bazaar: {
          info: {
            input: {
              method: "POST",
              pathParams: { tool: "search" },
              queryParams: { language: "en", tag: ["one", "two"] },
              body: { query: "Kite" },
            },
          },
        },
      },
    },
    "https://catalog.example.com/discovery/resources",
    "2026-09-24T01:00:00.000Z",
  );
  assert.ok(candidate);
  assert.equal(candidate.method, "POST");
  assert.equal(
    candidate.url,
    "https://api.example.com/tools/search?language=en&tag=one&tag=two",
  );
  assert.deepEqual(candidate.request?.body, { query: "Kite" });
  assert.equal(candidate.expectedNetwork, "eip155:8453");
});

test("skips unresolved route templates", () => {
  const candidate = normalizeBazaarItem(
    { type: "http", resource: "https://api.example.com/tools/:missing" },
    "https://catalog.example.com/discovery/resources",
    "2026-09-24T01:00:00.000Z",
  );
  assert.equal(candidate, undefined);
});
