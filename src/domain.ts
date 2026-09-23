export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type DecisionStatus = "pass" | "pending" | "reject";

export interface Candidate {
  id: string;
  method: HttpMethod;
  url: string;
  source: string;
  expectedNetwork?: string;
  expectedAsset?: string;
  expectedPriceUsd?: string;
}

export interface AssetPolicy {
  address: string;
  symbol: string;
  decimals: number;
  eip712Name: string;
  eip712Version: string;
}

export interface Policy {
  allowedNetworks: string[];
  assets: Record<string, AssetPolicy[]>;
  maxPriceUsd: string;
  requestTimeoutMs: number;
  retries: number;
  maxConcurrency: number;
  maxEvidenceBodyBytes: number;
  paymentBudget: {
    enabled: boolean;
    maxPerCallUsd: string;
    maxPerRunUsd: string;
  };
}

export interface PaymentTerm {
  scheme?: unknown;
  network?: unknown;
  amount?: unknown;
  asset?: unknown;
  payTo?: unknown;
  maxTimeoutSeconds?: unknown;
  extra?: unknown;
}

export interface PaymentChallenge {
  x402Version?: unknown;
  accepts?: unknown;
  error?: unknown;
  resource?: unknown;
}

export interface HttpEvidence {
  attempt: number;
  observedAt: string;
  elapsedMs: number;
  request: {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
    bodyTruncated: boolean;
  };
  error?: string;
}

export interface EvaluationResult {
  candidateId: string;
  status: DecisionStatus;
  reasonCodes: string[];
  summary: string;
  selectedTerm?: PaymentTerm;
  attemptStatuses: DecisionStatus[];
  evaluatedAt: string;
}

export interface RunRecord {
  runId: string;
  mode: "evaluation" | "monitor";
  startedAt: string;
  completedAt: string;
  candidateCount: number;
  counts: Record<DecisionStatus, number>;
  policyFile: string;
}

export interface ManualReview {
  candidateId: string;
  automatedDecision: DecisionStatus;
  finalRecommendation: DecisionStatus;
  reviewer: string;
  reviewedAt: string;
  rationale: string;
  misjudgmentCause?: string;
}

export interface PaymentAudit {
  candidateId: string;
  auditedAt: string;
  network: string;
  asset: string;
  amount: string;
  status: "success" | "failed";
  transaction?: string;
  responseStatus?: number;
  notes?: string;
}

export interface AlertRecord {
  candidateId: string;
  createdAt: string;
  severity: "warning" | "critical";
  reasonCodes: string[];
  message: string;
  runId: string;
}
