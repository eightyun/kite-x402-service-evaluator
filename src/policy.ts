import type {
  AssetPolicy,
  Candidate,
  DecisionStatus,
  EvaluationResult,
  HttpEvidence,
  PaymentTerm,
  Policy,
} from "./domain.js";
import { ReasonCode } from "./reason-codes.js";
import { decimalToAtomic, decodePaymentRequired, paymentTerms } from "./x402.js";

interface AttemptDecision {
  status: DecisionStatus;
  reasons: string[];
  summary: string;
  selectedTerm?: PaymentTerm;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function findAsset(policy: Policy, network: string, address: string): AssetPolicy | undefined {
  return policy.assets[network]?.find((asset) => asset.address.toLowerCase() === address.toLowerCase());
}

function evaluateTerm(candidate: Candidate, term: PaymentTerm, policy: Policy): string[] {
  const reasons: string[] = [];
  const scheme = asString(term.scheme);
  const network = asString(term.network);
  const assetAddress = asString(term.asset);
  const amount = asString(term.amount);
  const payTo = asString(term.payTo);
  const timeout = asNumber(term.maxTimeoutSeconds);

  if (scheme !== "exact") reasons.push(ReasonCode.UnsupportedScheme);
  if (!network || !policy.allowedNetworks.includes(network)) {
    reasons.push(ReasonCode.UnsupportedNetwork);
    return reasons;
  }
  if (candidate.expectedNetwork && candidate.expectedNetwork !== network) {
    reasons.push(ReasonCode.ExpectedNetworkMismatch);
  }
  if (!assetAddress) {
    reasons.push(ReasonCode.UnsupportedAsset);
    return reasons;
  }
  const asset = findAsset(policy, network, assetAddress);
  if (!asset) {
    reasons.push(ReasonCode.UnsupportedAsset);
    return reasons;
  }
  if (candidate.expectedAsset && candidate.expectedAsset.toLowerCase() !== assetAddress.toLowerCase()) {
    reasons.push(ReasonCode.ExpectedAssetMismatch);
  }
  if (!payTo || !/^0x[0-9a-fA-F]{40}$/.test(payTo)) reasons.push(ReasonCode.InvalidPayTo);
  if (!amount || !/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    reasons.push(ReasonCode.InvalidAmount);
  } else {
    const max = decimalToAtomic(policy.maxPriceUsd, asset.decimals);
    if (BigInt(amount) > max) reasons.push(ReasonCode.PriceAbovePolicy);
    if (
      candidate.expectedPriceUsd &&
      BigInt(amount) !== decimalToAtomic(candidate.expectedPriceUsd, asset.decimals)
    ) {
      reasons.push(ReasonCode.ExpectedPriceMismatch);
    }
  }
  if (!timeout || timeout < 1 || timeout > 300) reasons.push(ReasonCode.InvalidTimeout);

  const extra = term.extra;
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
    reasons.push(ReasonCode.InvalidEip712Domain);
  } else {
    const domain = extra as Record<string, unknown>;
    if (domain.name !== asset.eip712Name || domain.version !== asset.eip712Version) {
      reasons.push(ReasonCode.InvalidEip712Domain);
    }
  }
  return reasons;
}

export function evaluateAttempt(
  candidate: Candidate,
  evidence: HttpEvidence,
  policy: Policy,
): AttemptDecision {
  if (!evidence.response) {
    return {
      status: "pending",
      reasons: [ReasonCode.Unreachable],
      summary: evidence.error ?? "request failed",
    };
  }
  if (evidence.response.status !== 402) {
    return {
      status: "reject",
      reasons: [ReasonCode.No402Response],
      summary: `expected HTTP 402, received ${evidence.response.status}`,
    };
  }
  const encoded = evidence.response.headers["payment-required"];
  if (!encoded) {
    return {
      status: "reject",
      reasons: [ReasonCode.MissingPaymentRequired],
      summary: "HTTP 402 response has no PAYMENT-REQUIRED header",
    };
  }
  const parsed = decodePaymentRequired(encoded);
  if (!parsed.challenge) {
    return {
      status: "reject",
      reasons: [ReasonCode.InvalidPaymentRequired],
      summary: parsed.error ?? "invalid PAYMENT-REQUIRED header",
    };
  }
  if (parsed.challenge.x402Version !== 2) {
    return {
      status: "reject",
      reasons: [ReasonCode.InvalidX402Version],
      summary: "only x402 v2 is accepted",
    };
  }
  const terms = paymentTerms(parsed.challenge);
  if (terms.length === 0) {
    return {
      status: "reject",
      reasons: [ReasonCode.MissingAccepts],
      summary: "payment challenge has no usable accepts entry",
    };
  }
  const evaluated = terms.map((term) => ({ term, reasons: evaluateTerm(candidate, term, policy) }));
  const accepted = evaluated.find((entry) => entry.reasons.length === 0);
  if (accepted) {
    return {
      status: "pass",
      reasons: [],
      summary: "x402 v2 challenge satisfies the configured Kite admission policy",
      selectedTerm: accepted.term,
    };
  }
  return {
    status: "reject",
    reasons: [...new Set(evaluated.flatMap((entry) => entry.reasons))],
    summary: "no payment option satisfies the configured Kite admission policy",
  };
}

export function evaluateCandidate(
  candidate: Candidate,
  evidence: HttpEvidence[],
  policy: Policy,
): EvaluationResult {
  const decisions = evidence.map((attempt) => evaluateAttempt(candidate, attempt, policy));
  const statuses = decisions.map((decision) => decision.status);
  const stable = statuses.every((status) => status === statuses[0]);
  if (!stable) {
    return {
      candidateId: candidate.id,
      status: "pending",
      reasonCodes: [
        ReasonCode.UnstableEndpoint,
        ...new Set(decisions.flatMap((decision) => decision.reasons)),
      ],
      summary: "probe attempts produced inconsistent results; manual review is required",
      attemptStatuses: statuses,
      evaluatedAt: new Date().toISOString(),
    };
  }
  const first = decisions[0];
  if (!first) throw new Error(`${candidate.id}: no probe attempts were recorded`);
  const result: EvaluationResult = {
    candidateId: candidate.id,
    status: first.status,
    reasonCodes: [...new Set(decisions.flatMap((decision) => decision.reasons))],
    summary: first.summary,
    attemptStatuses: statuses,
    evaluatedAt: new Date().toISOString(),
  };
  if (first.selectedTerm) result.selectedTerm = first.selectedTerm;
  return result;
}
