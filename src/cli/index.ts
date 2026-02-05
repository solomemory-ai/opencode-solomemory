import { install } from "./install.js";

function printHelp(): void {
  console.log(`
oc-solomemory - Persistent memory for OpenCode agents

Usage:
  npx oc-solomemory@latest install <api-key>
  npx oc-solomemory@latest install --api-key=<key>

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

function handleCommand(command: string, args: string[]): number {
  if (command === "install") {
    return install(parseApiKey(args.slice(1)));
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

export function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (shouldShowHelp(command)) {
    printHelp();
    process.exit(0);
  }

  if (command === undefined) {
    process.exit(1);
  }

  const exitCode = handleCommand(command, args);
  process.exit(exitCode);
}
