import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type { Candidate, HttpMethod } from "./domain.js";
import { safeId, writeText } from "./io.js";

interface ServiceManifest {
  name?: unknown;
  status?: unknown;
  base_url?: unknown;
  network?: unknown;
  endpoints?: unknown;
}

interface ManifestEndpoint {
  method?: unknown;
  path?: unknown;
  price_usd?: unknown;
}

async function manifestFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name === "service.yaml")
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

export async function ingestManifests(root: string, output: string): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const file of await manifestFiles(root)) {
    const manifest = parse(await readFile(file, "utf8")) as ServiceManifest;
    if (
      typeof manifest.name !== "string" ||
      typeof manifest.base_url !== "string" ||
      typeof manifest.network !== "string" ||
      !Array.isArray(manifest.endpoints) ||
      manifest.status === "draft"
    ) {
      continue;
    }
    for (const raw of manifest.endpoints as ManifestEndpoint[]) {
      if (
        typeof raw.method !== "string" ||
        typeof raw.path !== "string" ||
        typeof raw.price_usd !== "string"
      ) {
        continue;
      }
      const method = raw.method.toUpperCase() as HttpMethod;
      const url = new URL(raw.path, `${manifest.base_url}/`).toString();
      candidates.push({
        id: safeId(`${manifest.name}-${method}-${raw.path}`),
        method,
        url,
        source: file,
        expectedNetwork: manifest.network,
        expectedPriceUsd: raw.price_usd,
      });
    }
  }
  const unique = [...new Map(candidates.map((candidate) => [`${candidate.method} ${candidate.url}`, candidate])).values()];
  await writeText(output, `${unique.map((candidate) => JSON.stringify(candidate)).join("\n")}\n`);
  return unique;
}
