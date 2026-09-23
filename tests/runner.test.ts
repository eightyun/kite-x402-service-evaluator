import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { Policy } from "../src/domain.js";
import { runEvaluation } from "../src/runner.js";

test("captures raw 402 evidence and writes reports", async (context) => {
  const terms = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: "eip155:2368",
        amount: "1000000000000000",
        asset: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A",
        payTo: "0x1111111111111111111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: { name: "pieUSD", version: "1" },
      },
    ],
  };
  const body = JSON.stringify(terms);
  const server = createServer((_request, response) => {
    response.writeHead(402, {
      "content-type": "application/json",
      "payment-required": Buffer.from(body).toString("base64"),
      "set-cookie": "secret=value",
    });
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test address");

  const directory = await mkdtemp(path.join(tmpdir(), "kite-evaluator-"));
  const input = path.join(directory, "candidates.jsonl");
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      input,
      `${JSON.stringify({ id: "fixture", method: "GET", url: `http://127.0.0.1:${address.port}/v1/good`, source: "test", expectedNetwork: "eip155:2368", expectedPriceUsd: "0.001" })}\n`,
    ),
  );
  const basePolicy = JSON.parse(await readFile("config/policy.json", "utf8")) as Policy;
  const policy: Policy = { ...basePolicy, retries: 1 };
  const run = await runEvaluation({
    inputFile: input,
    policyFile: "config/policy.json",
    policy,
    outputRoot: directory,
    mode: "evaluation",
    runId: "test-run",
  });
  assert.deepEqual(run.counts, { pass: 1, pending: 0, reject: 0 });
  const evidence = JSON.parse(
    await readFile(path.join(directory, "runs/test-run/candidates/fixture/probe.json"), "utf8"),
  ) as Array<{ response: { headers: Record<string, string> } }>;
  assert.equal(evidence[0]?.response.headers["set-cookie"], "[REDACTED]");
  assert.match(await readFile(path.join(directory, "runs/test-run/report.md"), "utf8"), /fixture.*pass/);
});
