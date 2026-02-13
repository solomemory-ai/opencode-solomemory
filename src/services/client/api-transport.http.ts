/**
 * HTTP transport layer for the Solomemory API.
 * Handles authentication, timeouts, and request/response plumbing.
 */

import { getApiKey, getApiUrl } from "../../config.js";

export const TIMEOUT_MS = 30_000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_RETRIES = 2;
export const RETRY_BASE_MS = 1000;

/**
 * Race a promise against a timeout. Rejects with a timeout error
 * if the promise does not settle within `ms` milliseconds.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timeout after " + String(ms) + "ms"));
      }, ms);
    }),
  ]);
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super("HTTP " + String(status) + ": " + message);
    this.name = "HttpError";
  }
}

const SERVER_ERROR_THRESHOLD = 500;

function isTransientError(error: unknown): boolean {
  if (error instanceof HttpError) return error.status >= SERVER_ERROR_THRESHOLD;
  if (error instanceof Error) {
    const msg = error.message;
    return msg.startsWith("Timeout after ") || msg.includes("fetch failed");
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function apiRequest(
  endpoint: string,
  method: string,
  body?: string,
): Promise<unknown> {
  const apiKey = getApiKey();
  if (apiKey === undefined) throw new Error("SOLOMEMORY_API_KEY not set");
  const url = getApiUrl() + endpoint;
  const response = await fetch(url, {
    method,
    body,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpError(response.status, errorText);
  }
  return response.json();
}

/** POST with JSON body, wrapped in the default timeout. */
export function post(endpoint: string, body: unknown): Promise<unknown> {
  return withTimeout(apiRequest(endpoint, "POST", JSON.stringify(body)), TIMEOUT_MS);
}

/** POST with retry on transient failures (5xx, timeout, network). */
export async function postWithRetry(endpoint: string, body: unknown): Promise<unknown> {
  const json = JSON.stringify(body);
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await withTimeout(apiRequest(endpoint, "POST", json), TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isTransientError(error)) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/** GET wrapped in the default timeout. */
export function get(endpoint: string): Promise<unknown> {
  return withTimeout(apiRequest(endpoint, "GET"), TIMEOUT_MS);
}
