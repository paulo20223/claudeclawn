import { mkdir } from "fs/promises";
import { join } from "path";

const LOGS_DIR = join(process.cwd(), ".claude/heartbeat/logs");

export async function run(name: string, prompt: string): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = join(LOGS_DIR, `${name}-${timestamp}.log`);

  console.log(`[${new Date().toLocaleTimeString()}] Running: ${name}`);

  const proc = Bun.spawn(["claude", "-p", prompt, "--output-format", "text"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  await proc.exited;

  const output = [
    `# ${name}`,
    `Date: ${new Date().toISOString()}`,
    `Prompt: ${prompt}`,
    `Exit code: ${proc.exitCode}`,
    "",
    "## Output",
    stdout,
    ...(stderr ? ["## Stderr", stderr] : []),
  ].join("\n");

  await Bun.write(logFile, output);
  console.log(`[${new Date().toLocaleTimeString()}] Done: ${name} → ${logFile}`);
}
