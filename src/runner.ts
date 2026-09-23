import path from "node:path";
import type {
  AlertRecord,
  Candidate,
  EvaluationResult,
  Policy,
  RunRecord,
} from "./domain.js";
import { validateCandidate } from "./config.js";
import { appendJsonLine, createRunId, readJsonLines, safeId, writeJson } from "./io.js";
import { evaluateCandidate } from "./policy.js";
import { probeCandidate } from "./probe.js";
import { countStatuses, writeReport } from "./report.js";

export interface RunOptions {
  inputFile: string;
  policyFile: string;
  policy: Policy;
  outputRoot: string;
  mode: "evaluation" | "monitor";
  runId?: string;
  alertFile?: string;
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < values.length) {
      const index = next;
      next += 1;
      const value = values[index];
      if (value !== undefined) results[index] = await mapper(value);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export async function runEvaluation(options: RunOptions): Promise<RunRecord> {
  const startedAt = new Date().toISOString();
  const runId = options.runId ?? createRunId();
  const runDirectory = path.join(options.outputRoot, "runs", safeId(runId));
  const candidates = (await readJsonLines<Candidate>(options.inputFile)).map(validateCandidate);
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (ids.has(candidate.id)) throw new Error(`duplicate candidate id: ${candidate.id}`);
    ids.add(candidate.id);
  }

  const evaluations = await mapConcurrent<Candidate, EvaluationResult>(
    candidates,
    options.policy.maxConcurrency,
    async (candidate) => {
      const evidence = await probeCandidate(candidate, options.policy);
      const evaluation = evaluateCandidate(candidate, evidence, options.policy);
      const directory = path.join(runDirectory, "candidates", safeId(candidate.id));
      await Promise.all([
        writeJson(path.join(directory, "candidate.json"), candidate),
        writeJson(path.join(directory, "probe.json"), evidence),
        writeJson(path.join(directory, "decision.json"), evaluation),
      ]);
      return evaluation;
    },
  );

  const run: RunRecord = {
    runId,
    mode: options.mode,
    startedAt,
    completedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    counts: countStatuses(evaluations),
    policyFile: options.policyFile,
  };
  await writeJson(path.join(runDirectory, "run.json"), run);
  await writeReport(runDirectory, run, candidates, evaluations);

  if (options.mode === "monitor" && options.alertFile) {
    for (const evaluation of evaluations.filter((entry) => entry.status !== "pass")) {
      const alert: AlertRecord = {
        candidateId: evaluation.candidateId,
        createdAt: new Date().toISOString(),
        severity: evaluation.status === "reject" ? "critical" : "warning",
        reasonCodes: evaluation.reasonCodes,
        message: evaluation.summary,
        runId,
      };
      await appendJsonLine(options.alertFile, alert);
    }
  }
  return run;
}
