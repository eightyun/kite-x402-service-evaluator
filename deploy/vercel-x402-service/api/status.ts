const FACILITATOR_URL = "https://facilitator.pieverse.io/v2";
const PAY_TO = process.env.PAY_TO ?? "0xd871e82bcee8954971152abc3df74455c21b1baf";

const requirement = {
  scheme: "exact",
  network: "eip155:2368",
  amount: "1000000000000000",
  asset: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A",
  payTo: PAY_TO,
  maxTimeoutSeconds: 60,
  extra: { name: "pieUSD", version: "1" },
};

function publicUrl(request: { headers: Record<string, string | string[] | undefined> }): string {
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  const value = Array.isArray(host) ? host[0] : host;
  return `https://${value ?? "localhost"}/v1/status`;
}

function challenge(
  request: { headers: Record<string, string | string[] | undefined> },
  response: { status: (value: number) => unknown; setHeader: (name: string, value: string) => void; json: (value: unknown) => void },
  error: string,
): void {
  const body = {
    x402Version: 2,
    error,
    resource: {
      url: publicUrl(request),
      description: "Kite x402 evaluator monitoring fixture",
      mimeType: "application/json",
    },
    accepts: [requirement],
  };
  response.setHeader("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(body)).toString("base64"));
  response.status(402);
  response.json(body);
}

async function facilitator(endpoint: "verify" | "settle", body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${FACILITATOR_URL}/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`facilitator ${endpoint} returned ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export default async function handler(
  request: { method?: string; headers: Record<string, string | string[] | undefined> },
  response: {
    status: (value: number) => { json: (value: unknown) => void };
    setHeader: (name: string, value: string) => void;
    json: (value: unknown) => void;
  },
): Promise<void> {
  if (request.method !== "GET") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const encoded = request.headers["payment-signature"];
  const signature = Array.isArray(encoded) ? encoded[0] : encoded;
  if (!signature) {
    challenge(request, response, "PAYMENT-SIGNATURE header is required");
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(signature, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    challenge(request, response, "invalid PAYMENT-SIGNATURE");
    return;
  }
  if (
    payload.x402Version !== 2 ||
    JSON.stringify(payload.accepted) !== JSON.stringify(requirement) ||
    !payload.payload ||
    typeof payload.payload !== "object"
  ) {
    challenge(request, response, "payment does not match this route");
    return;
  }

  const payment = {
    x402Version: 2,
    paymentPayload: payload,
    paymentRequirements: requirement,
  };
  try {
    const verification = await facilitator("verify", payment);
    if (verification.isValid !== true) {
      challenge(request, response, "payment verification failed");
      return;
    }
    const settlement = await facilitator("settle", payment);
    if (settlement.success !== true) {
      response.status(502).json({ error: "payment settlement failed" });
      return;
    }
    response.setHeader("PAYMENT-RESPONSE", Buffer.from(JSON.stringify(settlement)).toString("base64"));
    response.status(200).json({ ok: true, service: "kite-x402-monitor-fixture" });
  } catch (error) {
    response.status(502).json({
      error: "payment facilitator unavailable",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
