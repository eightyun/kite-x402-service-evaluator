import { createHash } from "node:crypto";
import { access, copyFile, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Candidate, EvaluationResult, HttpEvidence, RunRecord } from "./domain.js";
import { writeJson, writeText } from "./io.js";

interface DecisionRecord {
  candidate: Candidate;
  decision: EvaluationResult;
}

async function digest(file: string): Promise<{ file: string; bytes: number; sha256: string }> {
  const [contents, details] = await Promise.all([readFile(file), stat(file)]);
  return {
    file: path.basename(file),
    bytes: details.size,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

export async function exportRun(runDirectory: string, outputDirectory: string): Promise<void> {
  const candidatesDirectory = path.join(runDirectory, "candidates");
  const ids = (await readdir(candidatesDirectory)).sort();
  const decisions: DecisionRecord[] = [];
  const raw402: Array<{ candidateId: string; source: string; evidence: HttpEvidence }> = [];
  const reasonCounts: Record<string, number> = {};
  const httpStatusCounts: Record<string, number> = {};
  const hosts = new Set<string>();
  let attempts = 0;
  let responseAttempts = 0;
  let errorAttempts = 0;

  for (const id of ids) {
    const directory = path.join(candidatesDirectory, id);
    const [candidate, decision, evidence] = await Promise.all([
      readFile(path.join(directory, "candidate.json"), "utf8").then(
        (value) => JSON.parse(value) as Candidate,
      ),
      readFile(path.join(directory, "decision.json"), "utf8").then(
        (value) => JSON.parse(value) as EvaluationResult,
      ),
      readFile(path.join(directory, "probe.json"), "utf8").then(
        (value) => JSON.parse(value) as HttpEvidence[],
      ),
    ]);
    decisions.push({ candidate, decision });
    hosts.add(new URL(candidate.url).hostname);
    for (const reason of decision.reasonCodes) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    for (const attempt of evidence) {
      attempts += 1;
      if (attempt.response) {
        responseAttempts += 1;
        const status = String(attempt.response.status);
        httpStatusCounts[status] = (httpStatusCounts[status] ?? 0) + 1;
        if (attempt.response.status === 402) {
          raw402.push({ candidateId: candidate.id, source: candidate.source, evidence: attempt });
        }
      } else {
        errorAttempts += 1;
      }
    }
  }

  const run = JSON.parse(await readFile(path.join(runDirectory, "run.json"), "utf8")) as RunRecord;
  await writeJson(path.join(outputDirectory, "summary.json"), {
    run,
    uniqueHosts: hosts.size,
    attempts,
    responseAttempts,
    errorAttempts,
    raw402Responses: raw402.length,
    reasonCounts,
    httpStatusCounts,
  });
  await writeText(
    path.join(outputDirectory, "decisions.jsonl"),
    `${decisions.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  await writeText(
    path.join(outputDirectory, "raw-402.jsonl"),
    `${raw402.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  await Promise.all([
    copyFile(path.join(runDirectory, "report.json"), path.join(outputDirectory, "evaluation-report.json")),
    copyFile(path.join(runDirectory, "report.md"), path.join(outputDirectory, "evaluation-report.md")),
  ]);
  const evidenceFiles = [
    "summary.json",
    "decisions.jsonl",
    "raw-402.jsonl",
    "evaluation-report.json",
    "evaluation-report.md",
  ].map((file) => path.join(outputDirectory, file));
  const sourceFile = path.join(outputDirectory, "source.json");
  try {
    await access(sourceFile);
    evidenceFiles.push(sourceFile);
  } catch {
    // Source evidence is optional for runs created from a hand-curated inventory.
  }
  await writeJson(path.join(outputDirectory, "integrity.json"), {
    generatedAt: new Date().toISOString(),
    files: await Promise.all(evidenceFiles.map(digest)),
  });
}
