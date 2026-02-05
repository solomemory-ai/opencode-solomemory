import { appendFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const LOG_FILE = path.join(homedir(), ".opencode-solomemory.log");

const logQueue: string[] = [];
let flushScheduled = false;
let initialized = false;

async function flushLogs(): Promise<void> {
  if (logQueue.length === 0) {
    flushScheduled = false;
    return;
  }

  const entries = logQueue.splice(0);
  const content = entries.join("");

  try {
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
  const line = data
    ? `[${timestamp}] ${message}: ${JSON.stringify(data)}\n`
    : `[${timestamp}] ${message}\n`;

  logQueue.push(line);
  scheduleFlush();
}
