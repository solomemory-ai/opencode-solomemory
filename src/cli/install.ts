import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { Interface as ReadlineInterface } from "node:readline";

import { getCredentialsDir, saveCredentials } from "../services/auth.js";
import { stripJsoncComments } from "../services/jsonc.js";
import { login } from "./auth.js";
import { confirm, createReadline } from "./prompt.js";
import { SOLOMEMORY_INIT_COMMAND, SOLOMEMORY_LOGIN_COMMAND } from "./templates.js";

const OPENCODE_CONFIG_DIR = path.join(homedir(), ".config", "opencode");
const OPENCODE_COMMAND_DIR = path.join(OPENCODE_CONFIG_DIR, "command");
const OH_MY_OPENCODE_CONFIG = path.join(OPENCODE_CONFIG_DIR, "oh-my-opencode.json");
const PLUGIN_NAME = "oc-solomemory@latest";
const JSON_INDENT_SPACES = 2;
const SEPARATOR_WIDTH = 50;

interface OpencodeConfig {
  plugin?: string[];
  [key: string]: unknown;
}

interface OhMyOpencodeConfig {
  disabled_hooks?: string[];
  [key: string]: unknown;
}

function isOpencodeConfig(value: unknown): value is OpencodeConfig {
  return typeof value === "object" && value !== null;
}

function isOhMyOpencodeConfig(value: unknown): value is OhMyOpencodeConfig {
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

function isOhMyOpencodeInstalled(): boolean {
  const configPath = findOpencodeConfig();
  if (configPath === null) return false;

  try {
    const content = readFileSync(configPath, "utf8");
    return content.includes("oh-my-opencode");
  } catch {
    return false;
  }
}

function isAutoCompactAlreadyDisabled(): boolean {
  if (!existsSync(OH_MY_OPENCODE_CONFIG)) return false;

  try {
    const content = readFileSync(OH_MY_OPENCODE_CONFIG, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (!isOhMyOpencodeConfig(parsed)) {
      return false;
    }
    const disabledHooks = parsed.disabled_hooks;
    return disabledHooks?.includes("anthropic-context-window-limit-recovery") ?? false;
  } catch {
    return false;
  }
}

function loadOhMyOpencodeConfig(): OhMyOpencodeConfig {
  if (!existsSync(OH_MY_OPENCODE_CONFIG)) {
    return {};
  }

  const content = readFileSync(OH_MY_OPENCODE_CONFIG, "utf8");
  const parsed: unknown = JSON.parse(content);
  return isOhMyOpencodeConfig(parsed) ? parsed : {};
}

function addDisabledHook(config: OhMyOpencodeConfig): void {
  const disabledHooks = config.disabled_hooks ?? [];
  if (!disabledHooks.includes("anthropic-context-window-limit-recovery")) {
    disabledHooks.push("anthropic-context-window-limit-recovery");
  }
  config.disabled_hooks = disabledHooks;
}

function disableAutoCompactHook(): boolean {
  try {
    const config = loadOhMyOpencodeConfig();
    addDisabledHook(config);
    writeFileSync(OH_MY_OPENCODE_CONFIG, JSON.stringify(config, null, JSON_INDENT_SPACES));
    console.log(`✓ Disabled anthropic-context-window-limit-recovery hook in oh-my-opencode.json`);
    return true;
  } catch (error: unknown) {
    console.error("✗ Failed to update oh-my-opencode.json:", error);
    return false;
  }
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

function printOhMyOpencodeInfo(): void {
  console.log("\nStep 3: Configure Oh My OpenCode");
  console.log("Detected Oh My OpenCode plugin.");
  console.log(
    "Solo Memory handles context compaction, so the built-in context-window-limit-recovery hook should be disabled.",
  );
}

async function handleInteractiveOhMyOpencode(rl: ReadlineInterface): Promise<void> {
  const shouldDisable = await confirm(
    rl,
    "Disable anthropic-context-window-limit-recovery hook to let Solo Memory handle context?",
  );
  if (shouldDisable) {
    disableAutoCompactHook();
  } else {
    console.log("Skipped.");
  }
}

async function stepConfigureOhMyOpencode(
  rl: ReadlineInterface | null,
  disableAutoCompact: boolean,
): Promise<void> {
  if (!isOhMyOpencodeInstalled()) return;

  printOhMyOpencodeInfo();

  if (isAutoCompactAlreadyDisabled()) {
    console.log("✓ anthropic-context-window-limit-recovery hook already disabled");
    return;
  }

  if (rl !== null) {
    await handleInteractiveOhMyOpencode(rl);
    return;
  }

  if (disableAutoCompact) {
    disableAutoCompactHook();
  } else {
    console.log(
      "Skipped. Use --disable-context-recovery to disable the hook in non-interactive mode.",
    );
  }
}

interface InstallOptions {
  readonly tui: boolean;
  readonly disableAutoCompact: boolean;
  readonly apiKey: string | undefined;
}

function stepConfigureApiKey(options: InstallOptions): Promise<number> {
  console.log("\n" + "─".repeat(SEPARATOR_WIDTH));
  console.log("\n🔑 Final step: Configure API key\n");

  if (options.apiKey !== undefined) {
    saveCredentials(options.apiKey);
    console.log(`✓ API key saved to ${getCredentialsDir()}`);
    console.log("\n✓ Setup complete! Restart OpenCode to activate.\n");
    return Promise.resolve(0);
  }

  if (options.tui) {
    return login();
  }

  console.error("✗ API key is required. Use --api-key=KEY in non-interactive mode.");
  console.error("\nExample:\n  npx oc-solomemory@latest install --api-key=your-key --no-tui");
  return Promise.resolve(1);
}

export async function install(options: InstallOptions): Promise<number> {
  console.log("\n🧠 oc-solomemory installer\n");

  const rl = options.tui ? createReadline() : null;

  await stepRegisterPlugin(rl);
  await stepCreateCommands(rl);
  await stepConfigureOhMyOpencode(rl, options.disableAutoCompact);

  if (rl !== null) {
    rl.close();
  }

  return stepConfigureApiKey(options);
}
