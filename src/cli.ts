#!/usr/bin/env node
import { loadPolicy } from "./config.js";
import { discoverBazaar, discoverBazaarSnapshots } from "./bazaar.js";
import { exportRun } from "./export.js";
import type { DecisionStatus, ManualReview, PaymentAudit } from "./domain.js";
import { ingestManifests } from "./ingest.js";
import { recordPaymentAudit, recordReview } from "./records.js";
import { replayEvaluation, runEvaluation } from "./runner.js";

function args(values: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith("--")) throw new Error(`unexpected argument: ${key}`);
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
    result.set(key.slice(2), value);
    index += 1;
  }
  return result;
}

function required(options: Map<string, string>, key: string): string {
  const value = options.get(key);
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

function usage(): string {
  return `kite-x402-evaluator

Commands:
  discover --endpoint <bazaar-url> --limit <count> --out <candidates.jsonl> --source <source.json>
  discover-snapshots --directory <dir> --prefix <prefix> --endpoint <url> --limit <count> --out <candidates.jsonl> --source <source.json>
  ingest --root <services-dir> --out <candidates.jsonl>
  probe --input <candidates.jsonl> [--policy config/policy.json] [--out artifacts]
  monitor --input <admitted.jsonl> [--policy config/policy.json] [--out artifacts] [--alerts alerts/alerts.jsonl]
  export --run <artifacts/runs/run-id> --out <reports/run-id>
  replay --source-run <artifacts/runs/run-id> --policy <policy.json> --out <artifacts> --run-id <id>
  review --candidate <id> --automated <status> --final <status> --reviewer <name> --rationale <text> [--misjudgment <text>]
  record-payment --candidate <id> --network <caip2> --asset <address> --amount <atomic> --status <success|failed> [--transaction <hash>] [--notes <text>]
`;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || command === "help" || command === "--help") {
    console.log(usage());
    return;
  }
  const options = args(process.argv.slice(3));
  if (command === "discover") {
    const records = await discoverBazaar({
      endpoint: required(options, "endpoint"),
      limit: Number(required(options, "limit")),
      outputFile: required(options, "out"),
      sourceFile: required(options, "source"),
    });
    console.log(JSON.stringify({ discovered: records.length }));
    return;
  }
  if (command === "discover-snapshots") {
    const records = await discoverBazaarSnapshots({
      directory: required(options, "directory"),
      prefix: required(options, "prefix"),
      endpoint: required(options, "endpoint"),
      limit: Number(required(options, "limit")),
      outputFile: required(options, "out"),
      sourceFile: required(options, "source"),
    });
    console.log(JSON.stringify({ discovered: records.length }));
    return;
  }
  if (command === "ingest") {
    const records = await ingestManifests(required(options, "root"), required(options, "out"));
    console.log(JSON.stringify({ ingested: records.length }));
    return;
  }
  if (command === "probe" || command === "monitor") {
    const policyFile = options.get("policy") ?? "config/policy.json";
    const policy = await loadPolicy(policyFile);
    const run = await runEvaluation({
      inputFile: required(options, "input"),
      policyFile,
      policy,
      outputRoot: options.get("out") ?? "artifacts",
      mode: command === "monitor" ? "monitor" : "evaluation",
      ...(options.has("run-id") ? { runId: options.get("run-id")! } : {}),
      ...(command === "monitor"
        ? { alertFile: options.get("alerts") ?? "alerts/alerts.jsonl" }
        : {}),
    });
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  if (command === "export") {
    await exportRun(required(options, "run"), required(options, "out"));
    console.log(JSON.stringify({ exported: required(options, "out") }));
    return;
  }
  if (command === "replay") {
    const policyFile = options.get("policy") ?? "config/policy.json";
    const run = await replayEvaluation({
      sourceRunDirectory: required(options, "source-run"),
      policyFile,
      policy: await loadPolicy(policyFile),
      outputRoot: options.get("out") ?? "artifacts",
      runId: required(options, "run-id"),
    });
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  if (command === "review") {
    const review: ManualReview = {
      candidateId: required(options, "candidate"),
      automatedDecision: required(options, "automated") as DecisionStatus,
      finalRecommendation: required(options, "final") as DecisionStatus,
      reviewer: required(options, "reviewer"),
      reviewedAt: new Date().toISOString(),
      rationale: required(options, "rationale"),
      ...(options.has("misjudgment")
        ? { misjudgmentCause: options.get("misjudgment")! }
        : {}),
    };
    await recordReview(options.get("out") ?? "reviews/reviews.jsonl", review);
    console.log(JSON.stringify(review, null, 2));
    return;
  }
  if (command === "record-payment") {
    const audit: PaymentAudit = {
      candidateId: required(options, "candidate"),
      auditedAt: new Date().toISOString(),
      network: required(options, "network"),
      asset: required(options, "asset"),
      amount: required(options, "amount"),
      status: required(options, "status") as "success" | "failed",
      ...(options.has("transaction") ? { transaction: options.get("transaction")! } : {}),
      ...(options.has("response-status")
        ? { responseStatus: Number(options.get("response-status")) }
        : {}),
      ...(options.has("notes") ? { notes: options.get("notes")! } : {}),
    };
    await recordPaymentAudit(options.get("out") ?? "payment-audits/audits.jsonl", audit);
    console.log(JSON.stringify(audit, null, 2));
    return;
  }
  throw new Error(`unknown command: ${command}\n\n${usage()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
