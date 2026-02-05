import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { Interface as ReadlineInterface } from "node:readline";

import { getCredentialsDir, saveCredentials } from "../services/auth.js";
import { stripJsoncComments } from "../services/jsonc.js";
import { confirm, createReadline } from "./prompt.js";
import { SOLOMEMORY_INIT_COMMAND, SOLOMEMORY_LOGIN_COMMAND } from "./templates.js";

const OPENCODE_CONFIG_DIR = path.join(homedir(), ".config", "opencode");
const OPENCODE_COMMAND_DIR = path.join(OPENCODE_CONFIG_DIR, "command");
const PLUGIN_NAME = "oc-solomemory@latest";
const JSON_INDENT_SPACES = 2;
const SEPARATOR_WIDTH = 50;

interface OpencodeConfig {
  plugin?: string[];
  [key: string]: unknown;
}

function isOpencodeConfig(value: unknown): value is OpencodeConfig {
  return typeof value === "object" && value !== null;
}

function parseOpencodeConfig(content: string): OpencodeConfig | null {
  const jsonContent = stripJsoncComments(content);
  try {
    const parsed: unknown = JSON.parse(jsonContent);
    if (!isOpencodeConfig(parsed)) {
      console.error("✗ Invalid config file format");
      return null;
    }
    return parsed;
  } catch {
    console.error("✗ Failed to parse config file");
    return null;
  }
}

function insertPluginIntoExistingArray(content: string): string {
  const match = /("plugin"\s*:\s*\[)([^\]]*?)(\])/.exec(content);
  if (match === null) return content;

  const fullMatch = match[0];
  const start = match[1] ?? "";
  const middle = match[2] ?? "";
  const end = match[JSON_INDENT_SPACES + 1] ?? "";

  const trimmed = middle.trim();
  const replacement =
    trimmed === ""
      ? `${start}\n    "${PLUGIN_NAME}"\n  ${end}`
      : `${start}${middle.trimEnd()},\n    "${PLUGIN_NAME}"\n  ${end}`;

  return content.replace(fullMatch, replacement);
}

function writePluginToJsonc(configPath: string, content: string): void {
  if (content.includes('"plugin"')) {
    writeFileSync(configPath, insertPluginIntoExistingArray(content));
  } else {
    const updated = content.replace(/^(\s*\{)/, `$1\n  "plugin": ["${PLUGIN_NAME}"],`);
    writeFileSync(configPath, updated);
  }
}

function updateConfigWithPlugin(configPath: string, content: string): void {
  if (configPath.endsWith(".jsonc")) {
    writePluginToJsonc(configPath, content);
  } else {
    const config = parseOpencodeConfig(content);
    if (config === null) return;
    const plugins = config.plugin ?? [];
    plugins.push(PLUGIN_NAME);
    config.plugin = plugins;
    writeFileSync(configPath, JSON.stringify(config, null, JSON_INDENT_SPACES));
  }
}

function addPluginToConfig(configPath: string): boolean {
  try {
    const content = readFileSync(configPath, "utf8");

    if (content.includes("oc-solomemory")) {
      console.log("✓ Plugin already registered in config");
      return true;
    }

    const config = parseOpencodeConfig(content);
    if (config === null) return false;

    updateConfigWithPlugin(configPath, content);
    console.log(`✓ Added plugin to ${configPath}`);
    return true;
  } catch (error: unknown) {
    console.error("✗ Failed to update config:", error);
    return false;
  }
}

function findOpencodeConfig(): string | null {
  const candidates = [
    path.join(OPENCODE_CONFIG_DIR, "opencode.jsonc"),
    path.join(OPENCODE_CONFIG_DIR, "opencode.json"),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

function createNewConfig(): boolean {
  const configPath = path.join(OPENCODE_CONFIG_DIR, "opencode.jsonc");
  mkdirSync(OPENCODE_CONFIG_DIR, { recursive: true });

  const config = `{
  "plugin": ["${PLUGIN_NAME}"]
}
`;

  writeFileSync(configPath, config);
  console.log(`✓ Created ${configPath}`);
  return true;
}

function createCommands(): boolean {
  mkdirSync(OPENCODE_COMMAND_DIR, { recursive: true });

  const initPath = path.join(OPENCODE_COMMAND_DIR, "solomemory-init.md");
  writeFileSync(initPath, SOLOMEMORY_INIT_COMMAND);
  console.log(`✓ Created /solomemory-init command`);

  const loginPath = path.join(OPENCODE_COMMAND_DIR, "solomemory-login.md");
  writeFileSync(loginPath, SOLOMEMORY_LOGIN_COMMAND);
  console.log(`✓ Created /solomemory-login command`);

  return true;
}

async function stepRegisterPlugin(rl: ReadlineInterface | null): Promise<void> {
  console.log("Step 1: Register plugin in OpenCode config");
  const configPath = findOpencodeConfig();

  if (configPath !== null) {
    const shouldModify = rl === null || (await confirm(rl, `Add plugin to ${configPath}?`));
    if (shouldModify) {
      addPluginToConfig(configPath);
    } else {
      console.log("Skipped.");
    }
    return;
  }

  const shouldCreate = rl === null || (await confirm(rl, "No OpenCode config found. Create one?"));
  if (shouldCreate) {
    createNewConfig();
  } else {
    console.log("Skipped.");
  }
}

async function stepCreateCommands(rl: ReadlineInterface | null): Promise<void> {
  console.log("\nStep 2: Create /solomemory-init and /solomemory-login commands");
  const shouldCreate = rl === null || (await confirm(rl, "Add solomemory commands?"));
  if (shouldCreate) {
    createCommands();
  } else {
    console.log("Skipped.");
  }
}

interface InstallOptions {
  readonly tui: boolean;
  readonly apiKey: string | undefined;
}

function stepConfigureApiKey(apiKey: string | undefined): number {
  console.log("\n" + "─".repeat(SEPARATOR_WIDTH));
  console.log("\n🔑 Final step: Configure API key\n");

  if (apiKey === undefined) {
    console.error("✗ API key is required.\n");
    console.error("Usage:");
    console.error("  npx oc-solomemory@latest install <api-key>");
    console.error("  npx oc-solomemory@latest install --api-key=<key>\n");
    console.error("Get your API key at https://solomemory.com");
    return 1;
  }

  saveCredentials(apiKey);
  console.log(`✓ API key saved to ${getCredentialsDir()}`);
  console.log("\n✓ Setup complete! Restart OpenCode to activate.\n");
  return 0;
}

export async function install(options: InstallOptions): Promise<number> {
  console.log("\n🧠 oc-solomemory installer\n");

  const rl = options.tui ? createReadline() : null;

  await stepRegisterPlugin(rl);
  await stepCreateCommands(rl);

  if (rl !== null) {
    rl.close();
  }

  return stepConfigureApiKey(options.apiKey);
}
