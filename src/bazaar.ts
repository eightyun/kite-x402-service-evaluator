import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Candidate, HttpMethod } from "./domain.js";
import { safeId, writeJson, writeText } from "./io.js";

const METHODS = new Set<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);

interface BazaarInput {
  method?: unknown;
  pathParams?: unknown;
  queryParams?: unknown;
  body?: unknown;
}

interface BazaarItem {
  accepts?: unknown;
  extensions?: unknown;
  lastUpdated?: unknown;
  resource?: unknown;
  type?: unknown;
}

interface BazaarPage {
  items?: unknown;
  pagination?: {
    total?: unknown;
  };
}

interface PageEvidence {
  offset: number;
  itemCount: number;
  sha256: string;
}

export interface BazaarDiscoveryOptions {
  endpoint: string;
  limit: number;
  outputFile: string;
  sourceFile: string;
  pageSize?: number;
}

export interface BazaarSnapshotOptions extends BazaarDiscoveryOptions {
  directory: string;
  prefix: string;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function discoveryInput(item: BazaarItem): BazaarInput {
  const extensions = object(item.extensions);
  const bazaar = object(extensions?.bazaar);
  const info = object(bazaar?.info);
  return object(info?.input) as BazaarInput | undefined ?? {};
}

function substitutePath(url: URL, rawParams: unknown): boolean {
  const params = object(rawParams) ?? {};
  for (const [name, value] of Object.entries(params)) {
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    const encoded = encodeURIComponent(String(value));
    url.pathname = url.pathname
      .replaceAll(`:${name}`, encoded)
      .replaceAll(`[${name}]`, encoded);
  }
  return !/(^|\/)[:[][^/\]]+\]?(?=\/|$)/.test(url.pathname);
}

function appendQuery(url: URL, rawParams: unknown): void {
  const params = object(rawParams) ?? {};
  for (const [name, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (["string", "number", "boolean"].includes(typeof entry)) {
        url.searchParams.append(name, String(entry));
      }
    }
  }
}

function firstPaymentTerm(item: BazaarItem): Record<string, unknown> | undefined {
  if (!Array.isArray(item.accepts)) return undefined;
  return item.accepts.map(object).find(Boolean);
}

export function normalizeBazaarItem(
  item: BazaarItem,
  source: string,
  discoveredAt: string,
): Candidate | undefined {
  if (item.type !== "http" || typeof item.resource !== "string") return undefined;
  const input = discoveryInput(item);
  const method = typeof input.method === "string" ? input.method.toUpperCase() : "GET";
  if (!METHODS.has(method as HttpMethod)) return undefined;

  let url: URL;
  try {
    url = new URL(item.resource);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || !substitutePath(url, input.pathParams)) return undefined;
  appendQuery(url, input.queryParams);

  const body = input.body;
  const key = `${method} ${url.toString()} ${body === undefined ? "" : JSON.stringify(body)}`;
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 10);
  const base = safeId(`${url.hostname}-${method}-${url.pathname}`).slice(0, 84);
  const term = firstPaymentTerm(item);
  const network = typeof term?.network === "string" ? term.network : undefined;
  const asset = typeof term?.asset === "string" ? term.asset : undefined;
  const catalogUpdatedAt =
    typeof item.lastUpdated === "string" && !Number.isNaN(Date.parse(item.lastUpdated))
      ? item.lastUpdated
      : undefined;

  return {
    id: `${base}-${digest}`,
    method: method as HttpMethod,
    url: url.toString(),
    source,
    ...(body !== undefined ? { request: { body } } : {}),
    discoveredAt,
    ...(catalogUpdatedAt ? { catalogUpdatedAt } : {}),
    ...(network ? { expectedNetwork: network } : {}),
    ...(asset ? { expectedAsset: asset } : {}),
  };
}

export async function discoverBazaar(options: BazaarDiscoveryOptions): Promise<Candidate[]> {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10_000) {
    throw new Error("discovery limit must be an integer between 1 and 10000");
  }
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:") throw new Error("discovery endpoint must use HTTPS");

  const discoveredAt = new Date().toISOString();
  const pageSize = options.pageSize ?? 20;
  const candidates = new Map<string, Candidate>();
  const pages: PageEvidence[] = [];
  let offset = 0;
  let catalogTotal: number | undefined;

  while (candidates.size < options.limit && (catalogTotal === undefined || offset < catalogTotal)) {
    const pageUrl = new URL(endpoint);
    pageUrl.searchParams.set("type", "http");
    pageUrl.searchParams.set("limit", String(pageSize));
    pageUrl.searchParams.set("offset", String(offset));
    const response = await fetch(pageUrl, {
      headers: { accept: "application/json", "user-agent": "kite-x402-service-evaluator/0.1" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`discovery request failed: HTTP ${response.status}`);
    const text = await response.text();
    const page = JSON.parse(text) as BazaarPage;
    const items = Array.isArray(page.items) ? (page.items as BazaarItem[]) : [];
    if (items.length === 0) break;
    const total = page.pagination?.total;
    if (typeof total === "number" && Number.isInteger(total)) catalogTotal = total;
    pages.push({
      offset,
      itemCount: items.length,
      sha256: createHash("sha256").update(text).digest("hex"),
    });
    for (const item of items) {
      const candidate = normalizeBazaarItem(item, options.endpoint, discoveredAt);
      if (!candidate) continue;
      const key = `${candidate.method} ${candidate.url} ${JSON.stringify(candidate.request?.body)}`;
      if (!candidates.has(key)) candidates.set(key, candidate);
      if (candidates.size >= options.limit) break;
    }
    offset += items.length;
  }

  const selected = [...candidates.values()];
  if (selected.length < options.limit) {
    throw new Error(`discovery returned only ${selected.length} usable unique candidates`);
  }
  await writeText(
    options.outputFile,
    `${selected.map((candidate) => JSON.stringify(candidate)).join("\n")}\n`,
  );
  await writeJson(options.sourceFile, {
    schema: 1,
    sourceType: "x402-bazaar",
    endpoint: options.endpoint,
    retrievedAt: discoveredAt,
    catalogTotal,
    selectedCandidates: selected.length,
    pages,
  });
  return selected;
}

export async function discoverBazaarSnapshots(
  options: BazaarSnapshotOptions,
): Promise<Candidate[]> {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10_000) {
    throw new Error("discovery limit must be an integer between 1 and 10000");
  }
  const entries = (await readdir(options.directory))
    .map((name) => {
      const match = name.match(new RegExp(`^${options.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)\\.json$`));
      return match?.[1] ? { name, offset: Number(match[1]) } : undefined;
    })
    .filter((entry): entry is { name: string; offset: number } => Boolean(entry))
    .sort((left, right) => left.offset - right.offset);
  if (entries.length === 0) throw new Error("no Bazaar snapshot pages found");

  const discoveredAt = new Date().toISOString();
  const candidates = new Map<string, Candidate>();
  const pages: PageEvidence[] = [];
  let catalogTotal: number | undefined;
  for (const entry of entries) {
    const text = await readFile(path.join(options.directory, entry.name), "utf8");
    const page = JSON.parse(text) as BazaarPage;
    const items = Array.isArray(page.items) ? (page.items as BazaarItem[]) : [];
    const total = page.pagination?.total;
    if (typeof total === "number" && Number.isInteger(total)) catalogTotal = total;
    pages.push({
      offset: entry.offset,
      itemCount: items.length,
      sha256: createHash("sha256").update(text).digest("hex"),
    });
    for (const item of items) {
      const candidate = normalizeBazaarItem(item, options.endpoint, discoveredAt);
      if (!candidate) continue;
      const key = `${candidate.method} ${candidate.url} ${JSON.stringify(candidate.request?.body)}`;
      if (!candidates.has(key)) candidates.set(key, candidate);
      if (candidates.size >= options.limit) break;
    }
    if (candidates.size >= options.limit) break;
  }
  const selected = [...candidates.values()];
  if (selected.length < options.limit) {
    throw new Error(`snapshots contained only ${selected.length} usable unique candidates`);
  }
  await writeText(
    options.outputFile,
    `${selected.map((candidate) => JSON.stringify(candidate)).join("\n")}\n`,
  );
  await writeJson(options.sourceFile, {
    schema: 1,
    sourceType: "x402-bazaar-snapshot",
    endpoint: options.endpoint,
    retrievedAt: discoveredAt,
    catalogTotal,
    selectedCandidates: selected.length,
    pages,
  });
  return selected;
}
