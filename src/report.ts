import path from "node:path";
import type { Candidate, DecisionStatus, EvaluationResult, RunRecord } from "./domain.js";
import { writeJson, writeText } from "./io.js";

export function countStatuses(evaluations: EvaluationResult[]): Record<DecisionStatus, number> {
  return evaluations.reduce<Record<DecisionStatus, number>>(
    (counts, result) => {
      counts[result.status] += 1;
      return counts;
    },
    { pass: 0, pending: 0, reject: 0 },
  );
}

export async function writeReport(
  directory: string,
  run: RunRecord,
  candidates: Candidate[],
  evaluations: EvaluationResult[],
): Promise<void> {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const report = { run, evaluations };
  await writeJson(path.join(directory, "report.json"), report);

  const rows = evaluations.map((evaluation) => {
    const candidate = byId.get(evaluation.candidateId);
    const reasons = evaluation.reasonCodes.length ? evaluation.reasonCodes.join(", ") : "—";
    return `| ${evaluation.candidateId} | ${candidate?.method ?? "?"} | ${candidate?.url ?? "?"} | ${evaluation.status} | ${reasons} |`;
  });
  const markdown = `# x402 admission evaluation report

- Run: \`${run.runId}\`
- Mode: \`${run.mode}\`
- Started: ${run.startedAt}
- Completed: ${run.completedAt}
- Candidates: ${run.candidateCount}
- Pass: ${run.counts.pass}
- Pending: ${run.counts.pending}
- Reject: ${run.counts.reject}

This report contains automated recommendations. KiteAI maintainers retain the
final admission decision.

| Candidate | Method | URL | Recommendation | Reason codes |
|---|---|---|---|---|
${rows.join("\n")}
`;
  await writeText(path.join(directory, "report.md"), markdown);
}
