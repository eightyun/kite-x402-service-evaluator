import type { PaymentChallenge, PaymentTerm } from "./domain.js";

export interface ParsedChallenge {
  challenge?: PaymentChallenge;
  error?: string;
}

export function decodePaymentRequired(value: string | undefined): ParsedChallenge {
  if (!value) return { error: "PAYMENT-REQUIRED header is missing" };
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as PaymentChallenge;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "decoded PAYMENT-REQUIRED is not an object" };
    }
    return { challenge: parsed };
  } catch (error) {
    return { error: `cannot decode PAYMENT-REQUIRED: ${String(error)}` };
  }
}

export function paymentTerms(challenge: PaymentChallenge): PaymentTerm[] {
  if (!Array.isArray(challenge.accepts)) return [];
  return challenge.accepts.filter(
    (term): term is PaymentTerm => Boolean(term && typeof term === "object" && !Array.isArray(term)),
  );
}

export function decimalToAtomic(value: string, decimals: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`invalid decimal amount: ${value}`);
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`amount has more than ${decimals} decimals`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}
