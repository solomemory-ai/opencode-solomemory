import { getCredentialsDir, loadCredentials, saveCredentials } from "../services/auth.js";
import { createReadline, prompt } from "./prompt.js";

export async function login(): Promise<number> {
  const existing = loadCredentials();
  if (existing) {
    console.log(
      "✓ API key already configured.\nTo reconfigure, delete credentials and run install again.",
    );
    return 0;
  }

  const rl = createReadline();
  console.log("\n🔑 Solo Memory API Key Setup\n");

  const apiKey = await prompt(rl, "Enter your API key: ");
  rl.close();

  if (!apiKey) {
    console.error("\n✗ No API key provided");
    return 1;
  }

  saveCredentials(apiKey);
  console.log(`\n✓ API key saved to ${getCredentialsDir()}\nRestart OpenCode to activate.\n`);
  return 0;
}
