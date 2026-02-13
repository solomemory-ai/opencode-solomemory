import { getApiKey, getApiUrl } from "../config.js";
import { log } from "./logger.js";

declare const PKG_VERSION: string;

/** Fire-and-forget timeout for error reports (shorter than normal API calls). */
const ERROR_REPORT_TIMEOUT_MS = 10_000;

interface ErrorReport {
  readonly message: string;
  readonly exceptionType?: string;
  readonly stack?: string;
  readonly level?: "debug" | "info" | "warning" | "error" | "fatal";
  readonly tags?: Record<string, string>;
  readonly extra?: Record<string, unknown>;
}

interface ErrorReportResponse {
  readonly success: boolean;
  readonly eventId?: string | null;
}

function isErrorReportResponse(data: unknown): data is ErrorReportResponse {
  return typeof data === "object" && data !== null && "success" in data;
}

function getPluginVersion(): string {
  // PKG_VERSION is injected at build time via --define
  const version: unknown = PKG_VERSION;
  return typeof version === "string" ? version : "unknown";
}

function getRuntime(): string {
  return "Bun" in globalThis ? "bun" : "node";
}

/**
 * Send a structured error report to the solomemory API.
 *
 * The API forwards it to Sentry server-side — DSN never leaves the server.
 * This is fire-and-forget: errors in reporting are logged but never thrown.
 */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  const report = buildReport(error, extra);
  if (report === null) return;

  void sendReport(report);
}

function extractTags(
  extra: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (extra === undefined) return undefined;
  const context = extra.context;
  if (typeof context === "string" && context.length > 0) return { context };
  return undefined;
}

function buildReport(error: unknown, extra?: Record<string, unknown>): ErrorReport | null {
  const tags = extractTags(extra);
  if (error instanceof Error) {
    return {
      message: error.message,
      exceptionType: error.name,
      stack: error.stack,
      level: "error",
      tags,
      extra,
    };
  }

  if (typeof error === "string" && error.length > 0) {
    return {
      message: error,
      level: "error",
      tags,
      extra,
    };
  }

  const fallback = safeStringify(error);
  if (fallback.length === 0) return null;

  return {
    message: fallback,
    exceptionType: typeof error,
    level: "error",
    tags,
    extra,
  };
}

function safeStringify(value: unknown): string {
  try {
    if (typeof value === "object" && value !== null) return JSON.stringify(value);
    return String(value);
  } catch {
    return "[unstringifiable error]";
  }
}

async function sendReport(report: ErrorReport): Promise<void> {
  const apiKey = getApiKey();
  if (apiKey === undefined) return;

  const url = getApiUrl() + "/errors";
  const body = JSON.stringify({
    message: report.message,
    level: report.level ?? "error",
    exceptionType: report.exceptionType,
    stack: report.stack,
    pluginVersion: getPluginVersion(),
    runtime: getRuntime(),
    platform: "opencode",
    tags: report.tags,
    extra: report.extra,
  });

  try {
    const response = await Promise.race([
      fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Timeout"));
        }, ERROR_REPORT_TIMEOUT_MS);
      }),
    ]);

    if (response.ok) {
      const data = await response.json();
      const eventId = isErrorReportResponse(data) ? data.eventId : null;
      log("errorReporter: sent", { eventId });
    } else {
      log("errorReporter: server rejected", { status: response.status });
    }
  } catch (error) {
    log("errorReporter: send failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
