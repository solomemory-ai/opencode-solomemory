/**
 * HTTP transport layer for the Solomemory API.
 * Handles authentication, timeouts, and request/response plumbing.
 */

import { getApiKey, getApiUrl } from "../../config.js";

export const TIMEOUT_MS = 30_000;
export const DEFAULT_PAGE_SIZE = 20;

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

/**
 * Low-level authenticated HTTP request to the Solomemory API.
 * Throws on missing API key or non-OK response status.
 */
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
    throw new Error("HTTP " + String(response.status) + ": " + errorText);
  }
  return response.json();
}

/** POST with JSON body, wrapped in the default timeout. */
export function post(endpoint: string, body: unknown): Promise<unknown> {
  return withTimeout(apiRequest(endpoint, "POST", JSON.stringify(body)), TIMEOUT_MS);
}

/** GET wrapped in the default timeout. */
export function get(endpoint: string): Promise<unknown> {
  return withTimeout(apiRequest(endpoint, "GET"), TIMEOUT_MS);
}
