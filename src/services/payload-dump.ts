/**
 * Ingest payload dumper.
 * Writes each ingest request payload as a separate JSON file for offline testing / demo fixtures.
 * Enabled via `dumpIngestPayloads: true` in config or `SOLOMEMORY_DUMP_INGEST=true` env var.
 *
 * Files are written to `~/.solomemory-dumps/` with a timestamped filename:
 *   ingest_<ISO-timestamp>_<sourceId-suffix>.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { IngestPayload } from "../services/client-types.js";
import { log } from "../services/logger.js";

const DUMP_DIR = path.join(homedir(), ".solomemory-dumps");

let dirEnsured = false;

async function ensureDumpDir(): Promise<void> {
  if (dirEnsured) return;
  try {
    await mkdir(DUMP_DIR, { recursive: true });
    dirEnsured = true;
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
    await ensureDumpDir();
    const filename = buildFilename(payload);
    const filePath = path.join(DUMP_DIR, filename);
    const content = JSON.stringify(payload, undefined, 2);
    await writeFile(filePath, content, "utf8");
    log("payload-dump: written", { path: filePath });
  } catch (error) {
    log("payload-dump: failed to write", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
