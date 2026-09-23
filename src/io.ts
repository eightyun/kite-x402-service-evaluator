import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function readJsonLines<T>(file: string): Promise<T[]> {
  const text = await readFile(file, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new Error(`${file}:${index + 1}: invalid JSON: ${String(error)}`);
      }
    });
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(file: string, value: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value, "utf8");
}

export async function appendJsonLine(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

export function safeId(value: string): string {
  const result = value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!result) throw new Error("identifier must contain an alphanumeric character");
  return result.slice(0, 96);
}

export function createRunId(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}
