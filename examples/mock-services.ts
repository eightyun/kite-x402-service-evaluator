import { createServer } from "node:http";

const testnetTerms = {
  x402Version: 2,
  error: "PAYMENT-SIGNATURE header is required",
  resource: {
    url: "http://127.0.0.1:3402/v1/good",
    description: "Local evaluator fixture",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:2368",
      amount: "1000000000000000",
      asset: "0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 60,
      extra: { name: "pieUSD", version: "1" },
    },
  ],
};

const server = createServer((request, response) => {
  if (request.url === "/v1/good") {
    const body = JSON.stringify(testnetTerms);
    response.writeHead(402, {
      "content-type": "application/json",
      "payment-required": Buffer.from(body).toString("base64"),
    });
    response.end(body);
    return;
  }
  if (request.url === "/v1/malformed") {
    response.writeHead(402, { "payment-required": "not-base64-json" });
    response.end("invalid challenge");
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true }));
});

server.listen(3402, "127.0.0.1", () => {
  console.log("mock x402 services listening on http://127.0.0.1:3402");
});
