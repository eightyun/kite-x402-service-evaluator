import type { Candidate, HttpEvidence, Policy } from "./domain.js";

const REDACTED_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "payment-signature",
]);

function evidenceHeaders(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [name, value] of headers.entries()) {
    output[name.toLowerCase()] = REDACTED_HEADERS.has(name.toLowerCase()) ? "[REDACTED]" : value;
  }
  return output;
}

async function readBody(response: Response, limit: number): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = limit - size;
    if (remaining <= 0) {
      truncated = true;
      await reader.cancel();
      break;
    }
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(chunk);
    size += chunk.byteLength;
    if (chunk.byteLength < value.byteLength) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(joined), truncated };
}

export async function probeOnce(
  candidate: Candidate,
  policy: Policy,
  attempt: number,
): Promise<HttpEvidence> {
  const started = performance.now();
  const observedAt = new Date().toISOString();
  const requestHeaders = {
    accept: "application/json",
    "user-agent": "kite-x402-service-evaluator/0.1",
  };
  try {
    const response = await fetch(candidate.url, {
      method: candidate.method,
      headers: requestHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(policy.requestTimeoutMs),
    });
    const captured = await readBody(response, policy.maxEvidenceBodyBytes);
    return {
      attempt,
      observedAt,
      elapsedMs: Math.round(performance.now() - started),
      request: { method: candidate.method, url: candidate.url, headers: requestHeaders },
      response: {
        status: response.status,
        headers: evidenceHeaders(response.headers),
        body: captured.body,
        bodyTruncated: captured.truncated,
      },
    };
  } catch (error) {
    return {
      attempt,
      observedAt,
      elapsedMs: Math.round(performance.now() - started),
      request: { method: candidate.method, url: candidate.url, headers: requestHeaders },
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

export async function probeCandidate(candidate: Candidate, policy: Policy): Promise<HttpEvidence[]> {
  const attempts: HttpEvidence[] = [];
  for (let attempt = 1; attempt <= policy.retries; attempt += 1) {
    attempts.push(await probeOnce(candidate, policy, attempt));
  }
  return attempts;
}
