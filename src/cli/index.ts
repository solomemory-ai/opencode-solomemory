import { login, logout } from "./auth.js";
import { install } from "./install.js";

function printHelp(): void {
  console.log(`
opencode-solomemory - Persistent memory for OpenCode agents

Commands:
  install    Install and configure the plugin
    --no-tui                     Non-interactive mode (for LLM agents)
    --disable-context-recovery   Disable Oh My OpenCode's context hook
  login      Configure API key
  logout     Clear stored credentials

Examples:
  bunx opencode-solomemory@latest install
  bunx opencode-solomemory@latest login
  bunx opencode-solomemory@latest logout
`);
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case "install":
    case "setup": {
      if (command === "setup") {
        console.log("Note: 'setup' is deprecated. Use 'install' instead.\n");
      }
      const noTui = args.includes("--no-tui");
      const disableAutoCompact = args.includes("--disable-context-recovery");
      const code = await install({ tui: !noTui, disableAutoCompact });
      process.exit(code);
      break;
    }
    case "login": {
      const code = await login();
      process.exit(code);
      break;
    }
    case "logout": {
      process.exit(logout());
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
    }
  }
}
