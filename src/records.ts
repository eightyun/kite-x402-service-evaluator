import type { DecisionStatus, ManualReview, PaymentAudit } from "./domain.js";
import { appendJsonLine } from "./io.js";

const STATUSES = new Set<DecisionStatus>(["pass", "pending", "reject"]);

export async function recordReview(file: string, review: ManualReview): Promise<void> {
  if (!STATUSES.has(review.automatedDecision) || !STATUSES.has(review.finalRecommendation)) {
    throw new Error("review decisions must be pass, pending, or reject");
  }
  if (!review.reviewer.trim() || !review.rationale.trim()) {
    throw new Error("reviewer and rationale are required");
  }
  await appendJsonLine(file, review);
}

export async function recordPaymentAudit(file: string, audit: PaymentAudit): Promise<void> {
  if (!/^eip155:\d+$/.test(audit.network)) throw new Error("invalid CAIP-2 network");
  if (!/^0x[0-9a-fA-F]{40}$/.test(audit.asset)) throw new Error("invalid EVM asset address");
  if (!/^\d+$/.test(audit.amount) || BigInt(audit.amount) <= 0n) {
    throw new Error("payment amount must be a positive atomic integer");
  }
  if (audit.status === "success" && !/^0x[0-9a-fA-F]{64}$/.test(audit.transaction ?? "")) {
    throw new Error("successful audits require a transaction hash");
  }
  await appendJsonLine(file, audit);
}
