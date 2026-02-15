/**
 * Ingest payload dumper.
 * Writes each ingest request payload as a separate JSON file for offline testing / demo fixtures.
 * Enabled via `dumpIngestPayloads: true` in config or `SOLOMEMORY_DUMP_INGEST=true` env var.
 *
 * Files are written to `~/.config/opencode/solomemory/dumps/` with a timestamped filename:
 *   ingest_<ISO-timestamp>_<sourceId-suffix>.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { CONFIG } from "../config.js";
import type { IngestPayload } from "../services/client-types.js";
import { log } from "../services/logger.js";

const DEFAULT_DUMP_DIR = path.join(homedir(), ".config", "opencode", "solomemory", "dumps");

function resolveDumpDir(): string {
  const configured = CONFIG.dumpDir;
  if (!configured) return DEFAULT_DUMP_DIR;
  if (configured.startsWith("~/")) {
    return path.join(homedir(), configured.slice(2));
  }
  return path.resolve(configured);
}

let ensuredDir = "";

async function ensureDumpDir(dir: string): Promise<void> {
  if (ensuredDir === dir) return;
  try {
    await mkdir(dir, { recursive: true });
    ensuredDir = dir;
  } catch {
    // If we can't create the dir, we'll fail on write — logged there
  }
}

const MAX_SUFFIX_LENGTH = 40;

function sanitizeForFilename(value: string): string {
  return value.replaceAll(/[^\w-]/g, "_").slice(0, MAX_SUFFIX_LENGTH);
}

function buildFilename(payload: IngestPayload): string {
  const now = new Date();
  const ts = now.toISOString().replaceAll(":", "-").replace("T", "_").replace("Z", "");
  const suffix = sanitizeForFilename(payload.sourceId);
  return `ingest_${ts}_${suffix}.json`;
}

export async function dumpIngestPayload(payload: IngestPayload): Promise<void> {
  try {
    const dumpDir = resolveDumpDir();
    await ensureDumpDir(dumpDir);
    const filename = buildFilename(payload);
    const filePath = path.join(dumpDir, filename);
    const content = JSON.stringify(payload, undefined, 2);
    await writeFile(filePath, content, "utf8");
    log("payload-dump: written", { path: filePath });
  } catch (error) {
    log("payload-dump: failed to write", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
