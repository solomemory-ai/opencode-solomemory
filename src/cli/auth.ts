import {
  clearCredentials,
  getCredentialsDir,
  loadCredentials,
  saveCredentials,
} from "../services/auth.js";
import { createReadline, prompt } from "./prompt.js";

export async function login(): Promise<number> {
  const existing = loadCredentials();
  if (existing) {
    console.log("Already configured. Use 'logout' first to reconfigure.");
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
  console.log(`\n✓ API key saved to ${getCredentialsDir()}`);
  console.log("Restart OpenCode to activate.\n");
  return 0;
}

export function logout(): number {
  if (clearCredentials()) {
    console.log("✓ Logged out. Credentials cleared.");
  } else {
    console.log("No credentials found.");
  }
  return 0;
}
