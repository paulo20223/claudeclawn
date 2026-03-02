import { TelegramClient } from "@mtcute/bun";
import { join } from "path";
import { mkdir, rm, stat } from "fs/promises";
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

  try {
    await stat(sessionPath);
    const answer = await prompt("Session file already exists. Delete and re-auth? (y/n): ");
    if (answer.toLowerCase() === 'y') {
      await rm(sessionPath, { force: true });
      await rm(sessionPath + "-wal", { force: true });
      await rm(sessionPath + "-shm", { force: true });
      console.log("Removed old session files.");
    } else {
      console.log("Keeping existing session. Aborting auth.");
      return;
    }
  } catch {}

  const tg = new TelegramClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
    storage: sessionPath,
  });

  console.log("Starting mtcute authentication...");
  console.log(`Session will be saved to: ${sessionPath}`);
  try {
    const self = await tg.start({
      phone: async () => config.phoneNumber || await prompt("Phone number: "),
      code: () => prompt("Verification code: "),
      password: () => prompt("2FA password: "),
      forceSms: false,
      codeSentCallback: (sentCode) => {
        console.log(`Code sent via: ${sentCode.type}`);
        if (sentCode.nextType && sentCode.nextType !== 'none') {
          console.log(`Can resend via: ${sentCode.nextType}`);
        }
      },
    });

    console.log(`\nAuthenticated as: ${self.displayName}`);
    console.log(`User ID: ${self.id}`);

    await tg.disconnect();

    console.log("\nSession saved. Set mtcute.enabled to true in settings.json to use.");
  } catch (err: any) {
    const code = err?.code ?? err?.errorMessage;
    if (code === 406 || err?.errorMessage === "PHONE_NUMBER_INVALID") {
      console.error(`\nAuth failed (${code}): ${err.errorMessage ?? err.message}`);
      console.error("This usually means Telegram blocked this auth method for your number.");
      console.error("Try again later or use a different number.");
    } else {
      console.error(`\nAuth failed: ${err.message ?? err}`);
    }
    await tg.disconnect().catch(() => {});
    process.exit(1);
  }
}
