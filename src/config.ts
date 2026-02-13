import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { loadCredentials } from "./services/auth.js";
import { stripJsoncComments } from "./services/jsonc.js";

const CONFIG_DIR = path.join(homedir(), ".config", "opencode");
const CONFIG_FILES = [
  path.join(CONFIG_DIR, "solomemory.jsonc"),
  path.join(CONFIG_DIR, "solomemory.json"),
];

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
} as const;

function isSolomemoryConfig(data: unknown): data is SolomemoryConfig {
  return typeof data === "object" && data !== null;
}

function tryLoadConfigFile(filePath: string): SolomemoryConfig | null {
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf8");
    const json = stripJsoncComments(content);
    const data: unknown = JSON.parse(json);
    if (!isSolomemoryConfig(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function loadConfigFromFile(): SolomemoryConfig {
  for (const filePath of CONFIG_FILES) {
    const config = tryLoadConfigFile(filePath);
    if (config !== null) return config;
  }
  return {};
}

let _fileConfig: SolomemoryConfig | null = null;
let _apiKey: string | undefined;
let _apiUrl: string | undefined;
let _config: RuntimeConfig | null = null;
let _initialized = false;

function resolveApiKey(fileConfig: SolomemoryConfig): string | undefined {
  return process.env.SOLOMEMORY_API_KEY ?? fileConfig.apiKey ?? loadCredentials()?.apiKey;
}

function resolveApiUrl(fileConfig: SolomemoryConfig): string {
  return process.env.SOLOMEMORY_API_URL ?? fileConfig.apiUrl ?? DEFAULT_API_URL;
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
};

export const CONFIG: RuntimeConfig = new Proxy<RuntimeConfig>(emptyConfig, configHandler);
