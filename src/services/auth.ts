import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CREDENTIALS_DIR = path.join(homedir(), ".solomemory-opencode");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");

interface Credentials {
  apiKey: string;
  createdAt: string;
}

function isCredentials(data: unknown): data is Credentials {
  return (
    typeof data === "object" &&
    data !== null &&
    "apiKey" in data &&
    typeof data.apiKey === "string" &&
    "createdAt" in data &&
    typeof data.createdAt === "string"
  );
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_FILE)) return null;
  try {
    const content = readFileSync(CREDENTIALS_FILE, "utf8");
    const data: unknown = JSON.parse(content);
    if (!isCredentials(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCredentials(apiKey: string): void {
  mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  const credentials: Credentials = {
    apiKey,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

export function clearCredentials(): boolean {
  if (!existsSync(CREDENTIALS_FILE)) return false;
  rmSync(CREDENTIALS_FILE);
  return true;
}

export function getCredentialsDir(): string {
  return CREDENTIALS_DIR;
}
