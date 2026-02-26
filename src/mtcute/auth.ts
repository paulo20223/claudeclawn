import { TelegramClient } from "@mtcute/bun";
import { join } from "path";
import { mkdir } from "fs/promises";
import { createInterface } from "readline";
import type { MtcuteConfig } from "../config";

const MTCUTE_DIR = join(process.cwd(), ".claude", "claudeclaw", "mtcute");

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runAuthFlow(config: MtcuteConfig): Promise<void> {
  if (!config.apiId || !config.apiHash) {
    console.error("Error: mtcute.apiId and mtcute.apiHash must be set in settings.json");
    console.error("Get them at https://my.telegram.org/apps");
    process.exit(1);
  }

  await mkdir(MTCUTE_DIR, { recursive: true });

  const sessionPath = join(MTCUTE_DIR, `${config.sessionName}.session`);

  const tg = new TelegramClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
    storage: sessionPath,
  });

  console.log("Starting mtcute authentication...");
  console.log(`Session will be saved to: ${sessionPath}`);

  const self = await tg.start({
    phone: async () => config.phoneNumber || await prompt("Phone number: "),
    code: () => prompt("Verification code: "),
    password: () => prompt("2FA password: "),
  });

  console.log(`\nAuthenticated as: ${self.displayName}`);
  console.log(`User ID: ${self.id}`);

  await tg.disconnect();

  console.log("\nSession saved. Set mtcute.enabled to true in settings.json to use.");
}
