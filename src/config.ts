import { readJson } from "./io.js";
import type { Candidate, HttpMethod, Policy } from "./domain.js";

const METHODS = new Set<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const FORBIDDEN_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "payment-signature",
  "proxy-authorization",
  "x-payment",
]);

export async function loadPolicy(file: string): Promise<Policy> {
  const policy = await readJson<Policy>(file);
  if (!Array.isArray(policy.allowedNetworks) || policy.allowedNetworks.length === 0) {
    throw new Error("policy.allowedNetworks must contain at least one network");
  }
  if (!Number.isInteger(policy.retries) || policy.retries < 1 || policy.retries > 10) {
    throw new Error("policy.retries must be an integer between 1 and 10");
  }
  if (
    !Number.isInteger(policy.maxConcurrency) ||
    policy.maxConcurrency < 1 ||
    policy.maxConcurrency > 50
  ) {
    throw new Error("policy.maxConcurrency must be an integer between 1 and 50");
  }
  if (policy.paymentBudget.enabled) {
    throw new Error(
      "paid execution is not implemented in the baseline; record authorized audits explicitly",
    );
  }
  return policy;
}

export function validateCandidate(value: Candidate): Candidate {
  if (!value.id || !/^[a-z0-9][a-z0-9-]{1,95}$/.test(value.id)) {
    throw new Error(`invalid candidate id: ${JSON.stringify(value.id)}`);
  }
  if (!METHODS.has(value.method)) throw new Error(`${value.id}: unsupported HTTP method`);
  const url = new URL(value.url);
  if (!url.hostname) throw new Error(`${value.id}: URL must have a host`);
  if (url.username || url.password) throw new Error(`${value.id}: URL credentials are forbidden`);
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`${value.id}: public candidate URLs must use HTTPS`);
  }
  if (value.request?.headers) {
    for (const name of Object.keys(value.request.headers)) {
      if (FORBIDDEN_REQUEST_HEADERS.has(name.toLowerCase())) {
        throw new Error(`${value.id}: request header ${name} is forbidden`);
      }
    }
  }
  if (value.request?.body !== undefined) {
    const body = JSON.stringify(value.request.body);
    if (body.length > 65_536) throw new Error(`${value.id}: request body exceeds 64 KiB`);
  }
  if (!value.source) throw new Error(`${value.id}: source is required`);
  return value;
}
