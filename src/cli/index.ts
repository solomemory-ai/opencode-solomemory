import { install } from "./install.js";

function printHelp(): void {
  console.log(`
oc-solomemory - Persistent memory for OpenCode agents

Usage:
  npx oc-solomemory@latest install <api-key>
  npx oc-solomemory@latest install --api-key=<key>

Options:
  --no-tui   Non-interactive mode (for LLM agents)

Get your API key at https://solomemory.com
`);
}

function shouldShowHelp(command: string | undefined): boolean {
  return command === undefined || command === "help" || command === "--help" || command === "-h";
}

function parseApiKey(args: string[]): string | undefined {
  const flag = args.find((a: string) => a.startsWith("--api-key="));
  if (flag !== undefined) return flag.split("=")[1];

  const positional = args.find((a: string) => !a.startsWith("-"));
  return positional;
}

function handleInstallCommand(args: string[]): Promise<number> {
  const noTui = args.includes("--no-tui");
  const apiKey = parseApiKey(args);
  return install({ tui: !noTui, apiKey });
}

function handleCommand(command: string, args: string[]): Promise<number> {
  if (command === "install") {
    return handleInstallCommand(args.slice(1));
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return Promise.resolve(1);
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (shouldShowHelp(command)) {
    printHelp();
    process.exit(0);
  }

  if (command === undefined) {
    process.exit(1);
  }

  const exitCode = await handleCommand(command, args);
  process.exit(exitCode);
}
