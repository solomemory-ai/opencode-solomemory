import { login, logout } from "./auth.js";
import { install } from "./install.js";

function printHelp(): void {
  console.log(`
oc-solomemory - Persistent memory for OpenCode agents

Commands:
  install    Install and configure the plugin
    --no-tui                     Non-interactive mode (for LLM agents)
    --disable-context-recovery   Disable Oh My OpenCode's context hook
  login      Configure API key
  logout     Clear stored credentials

Examples:
  bunx oc-solomemory@latest install
  bunx oc-solomemory@latest login
  bunx oc-solomemory@latest logout
`);
}

function shouldShowHelp(command: string | undefined): boolean {
  return command === undefined || command === "help" || command === "--help" || command === "-h";
}

async function handleInstallCommand(args: string[]): Promise<number> {
  const noTui = args.includes("--no-tui");
  const disableAutoCompact = args.includes("--disable-context-recovery");
  return install({ tui: !noTui, disableAutoCompact });
}

async function handleCommand(command: string, args: string[]): Promise<number> {
  switch (command) {
    case "install":
    case "setup": {
      if (command === "setup") {
        console.log("Note: 'setup' is deprecated. Use 'install' instead.\n");
      }
      return handleInstallCommand(args);
    }
    case "login": {
      return login();
    }
    case "logout": {
      return logout();
    }
    default: {
      console.error(`Unknown command: ${command}`);
      printHelp();
      return 1;
    }
  }
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
