import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { stripJsoncComments } from "./services/jsonc.js";
import { loadCredentials } from "./services/auth.js";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILES = [
  join(CONFIG_DIR, "solomemory.jsonc"),
  join(CONFIG_DIR, "solomemory.json"),
];

const DEFAULT_API_URL = "https://api.solomemory.com";

interface SolomemoryConfig {
  apiKey?: string;
  apiUrl?: string;
  similarityThreshold?: number;
  maxMemories?: number;
  maxProjectMemories?: number;
  maxProfileItems?: number;
  injectProfile?: boolean;
  containerTagPrefix?: string;
  platformIdentifier?: string;
  autoSyncConversations?: boolean;
  filterPrompt?: string;
}

const DEFAULTS = {
  similarityThreshold: 0.6,
  maxMemories: 5,
  maxProjectMemories: 10,
  maxProfileItems: 5,
  injectProfile: true,
  containerTagPrefix: "opencode",
  platformIdentifier: "opencode",
  autoSyncConversations: true,
  filterPrompt: "You are a stateful coding agent. Remember all the information, including but not limited to user's coding preferences, tech stack, behaviours, workflows, and any other relevant details.",
} as const;

function loadConfigFromFile(): SolomemoryConfig {
  for (const path of CONFIG_FILES) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        const json = stripJsoncComments(content);
        return JSON.parse(json) as SolomemoryConfig;
      } catch {
        continue;
      }
    }
  }
  return {};
}

let _fileConfig: SolomemoryConfig | null = null;
let _apiKey: string | undefined;
let _apiUrl: string | undefined;
let _config: RuntimeConfig | null = null;
let _initialized = false;

function ensureInitialized(): void {
  if (_initialized) return;
  _initialized = true;
  
  _fileConfig = loadConfigFromFile();
  
  _apiKey = process.env.SOLOMEMORY_API_KEY 
    ?? _fileConfig.apiKey 
    ?? loadCredentials()?.apiKey;
  
  _apiUrl = process.env.SOLOMEMORY_API_URL 
    ?? _fileConfig.apiUrl 
    ?? DEFAULT_API_URL;
  
  _config = {
    similarityThreshold: _fileConfig.similarityThreshold ?? DEFAULTS.similarityThreshold,
    maxMemories: _fileConfig.maxMemories ?? DEFAULTS.maxMemories,
    maxProjectMemories: _fileConfig.maxProjectMemories ?? DEFAULTS.maxProjectMemories,
    maxProfileItems: _fileConfig.maxProfileItems ?? DEFAULTS.maxProfileItems,
    injectProfile: _fileConfig.injectProfile ?? DEFAULTS.injectProfile,
    containerTagPrefix: _fileConfig.containerTagPrefix ?? DEFAULTS.containerTagPrefix,
    platformIdentifier: _fileConfig.platformIdentifier ?? DEFAULTS.platformIdentifier,
    autoSyncConversations: _fileConfig.autoSyncConversations ?? DEFAULTS.autoSyncConversations,
    filterPrompt: _fileConfig.filterPrompt ?? DEFAULTS.filterPrompt,
  };
}

export function getApiKey(): string | undefined {
  ensureInitialized();
  return _apiKey;
}

export function getApiUrl(): string {
  ensureInitialized();
  return _apiUrl!;
}

export function isConfigured(): boolean {
  return !!getApiKey();
}

export interface RuntimeConfig {
  readonly similarityThreshold: number;
  readonly maxMemories: number;
  readonly maxProjectMemories: number;
  readonly maxProfileItems: number;
  readonly injectProfile: boolean;
  readonly containerTagPrefix: string;
  readonly platformIdentifier: string;
  readonly autoSyncConversations: boolean;
  readonly filterPrompt: string;
}

export function getConfig(): RuntimeConfig {
  ensureInitialized();
  return _config!;
}

export const CONFIG: RuntimeConfig = new Proxy({} as RuntimeConfig, {
  get(_target, prop: keyof RuntimeConfig) {
    return getConfig()[prop];
  },
});
