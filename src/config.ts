import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(homedir(), ".config", "opencode", "solomemory");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_API_URL = "https://api.solomemory.com";

interface SolomemoryConfig {
  apiKey?: string;
  apiUrl?: string;
  maxMemories?: number;
  maxProjectMemories?: number;
  maxProfileItems?: number;
  injectProfile?: boolean;
  platformIdentifier?: string;
  autoSyncConversations?: boolean;
  filterPrompt?: string;
  dumpIngestPayloads?: boolean;
  dumpDir?: string;
}

const DEFAULTS = {
  maxMemories: 5,
  maxProjectMemories: 10,
  maxProfileItems: 5,
  injectProfile: true,
  platformIdentifier: "opencode",
  autoSyncConversations: true,
  filterPrompt:
    "You are a stateful coding agent. Remember all the information, including but not limited to user's coding preferences, tech stack, behaviours, workflows, and any other relevant details.",
  dumpIngestPayloads: false,
  dumpDir: "",
} as const;

function isSolomemoryConfig(data: unknown): data is SolomemoryConfig {
  return typeof data === "object" && data !== null;
}

function loadConfigFromFile(): SolomemoryConfig {
  if (!existsSync(CONFIG_FILE)) return {};

  try {
    const content = readFileSync(CONFIG_FILE, "utf8");
    const data: unknown = JSON.parse(content);
    if (!isSolomemoryConfig(data)) return {};
    return data;
  } catch {
    return {};
  }
}

let _fileConfig: SolomemoryConfig | null = null;
let _apiKey: string | undefined;
let _apiUrl: string | undefined;
let _config: RuntimeConfig | null = null;
let _initialized = false;

function resolveApiKey(fileConfig: SolomemoryConfig): string | undefined {
  return process.env.SOLOMEMORY_API_KEY ?? fileConfig.apiKey;
}

function resolveApiUrl(fileConfig: SolomemoryConfig): string {
  return process.env.SOLOMEMORY_API_URL ?? fileConfig.apiUrl ?? DEFAULT_API_URL;
}

function resolveDumpConfig(
  fileConfig: SolomemoryConfig,
): Pick<RuntimeConfig, "dumpDir" | "dumpIngestPayloads"> {
  return {
    dumpIngestPayloads:
      process.env.SOLOMEMORY_DUMP_INGEST === "true" ||
      (fileConfig.dumpIngestPayloads ?? DEFAULTS.dumpIngestPayloads),
    dumpDir: process.env.SOLOMEMORY_DUMP_DIR ?? fileConfig.dumpDir ?? DEFAULTS.dumpDir,
  };
}

function buildRuntimeConfig(fileConfig: SolomemoryConfig): RuntimeConfig {
  return {
    maxMemories: fileConfig.maxMemories ?? DEFAULTS.maxMemories,
    maxProjectMemories: fileConfig.maxProjectMemories ?? DEFAULTS.maxProjectMemories,
    maxProfileItems: fileConfig.maxProfileItems ?? DEFAULTS.maxProfileItems,
    injectProfile: fileConfig.injectProfile ?? DEFAULTS.injectProfile,
    platformIdentifier: fileConfig.platformIdentifier ?? DEFAULTS.platformIdentifier,
    autoSyncConversations: fileConfig.autoSyncConversations ?? DEFAULTS.autoSyncConversations,
    filterPrompt: fileConfig.filterPrompt ?? DEFAULTS.filterPrompt,
    ...resolveDumpConfig(fileConfig),
  };
}

function ensureInitialized(): void {
  if (_initialized) return;
  _initialized = true;

  _fileConfig = loadConfigFromFile();
  _apiKey = resolveApiKey(_fileConfig);
  _apiUrl = resolveApiUrl(_fileConfig);
  _config = buildRuntimeConfig(_fileConfig);
}

export function getApiKey(): string | undefined {
  ensureInitialized();
  return _apiKey;
}

export function getApiUrl(): string {
  ensureInitialized();
  return _apiUrl ?? DEFAULT_API_URL;
}

export function isConfigured(): boolean {
  return !!getApiKey();
}

export interface RuntimeConfig {
  readonly maxMemories: number;
  readonly maxProjectMemories: number;
  readonly maxProfileItems: number;
  readonly injectProfile: boolean;
  readonly platformIdentifier: string;
  readonly autoSyncConversations: boolean;
  readonly filterPrompt: string;
  readonly dumpIngestPayloads: boolean;
  readonly dumpDir: string;
}

export function getConfig(): RuntimeConfig {
  ensureInitialized();
  if (_config === null) {
    throw new Error("Config not initialized");
  }
  return _config;
}

function isRuntimeConfigKey(prop: string): prop is keyof RuntimeConfig {
  const validKeys = [
    "maxMemories",
    "maxProjectMemories",
    "maxProfileItems",
    "injectProfile",
    "platformIdentifier",
    "autoSyncConversations",
    "filterPrompt",
    "dumpIngestPayloads",
    "dumpDir",
  ];
  return validKeys.includes(prop);
}

const configHandler: ProxyHandler<RuntimeConfig> = {
  get(_target, prop: string | symbol): unknown {
    if (typeof prop === "string" && isRuntimeConfigKey(prop)) {
      return getConfig()[prop];
    }
    return undefined;
  },
};

const emptyConfig: RuntimeConfig = {
  maxMemories: 0,
  maxProjectMemories: 0,
  maxProfileItems: 0,
  injectProfile: false,
  platformIdentifier: "",
  autoSyncConversations: false,
  filterPrompt: "",
  dumpIngestPayloads: false,
  dumpDir: "",
};

export const CONFIG: RuntimeConfig = new Proxy<RuntimeConfig>(emptyConfig, configHandler);

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigFile(): string {
  return CONFIG_FILE;
}

const JSON_INDENT = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function saveApiKey(apiKey: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });

  let existing: Record<string, unknown> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      const data: unknown = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
      if (isRecord(data)) {
        existing = data;
      }
    } catch {
      // Overwrite corrupt file
    }
  }

  existing.apiKey = apiKey;
  writeFileSync(CONFIG_FILE, JSON.stringify(existing, null, JSON_INDENT), { mode: 0o600 });
}
