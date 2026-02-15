import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const LOG_DIR = path.join(homedir(), ".config", "opencode", "solomemory");
const LOG_FILE = path.join(LOG_DIR, "solomemory.log");

const logQueue: string[] = [];
let flushScheduled = false;
let initialized = false;
let dirEnsured = false;

async function ensureLogDir(): Promise<void> {
  if (dirEnsured) return;
  await mkdir(LOG_DIR, { recursive: true });
  dirEnsured = true;
}

async function flushLogs(): Promise<void> {
  if (logQueue.length === 0) {
    flushScheduled = false;
    return;
  }

  const entries = logQueue.splice(0);
  const content = entries.join("");

  try {
    await ensureLogDir();
    if (initialized) {
      await appendFile(LOG_FILE, content);
    } else {
      await writeFile(
        LOG_FILE,
        `\n--- Session started: ${new Date().toISOString()} ---\n${content}`,
        { flag: "a" },
      );
      initialized = true;
    }
  } catch {
    // Logging should never crash the app
  }

  flushScheduled = false;
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  setImmediate(() => {
    void flushLogs();
  });
}

export function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const line =
    data === undefined
      ? `[${timestamp}] ${message}\n`
      : `[${timestamp}] ${message}: ${JSON.stringify(data)}\n`;

  logQueue.push(line);
  scheduleFlush();
}
