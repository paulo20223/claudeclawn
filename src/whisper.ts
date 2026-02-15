import { downloadWhisperModel, installWhisperCpp, transcribe } from "@remotion/install-whisper-cpp";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const WHISPER_CPP_VERSION = "1.7.6";
const WHISPER_MODEL = "base.en";
const WHISPER_ROOT = join(process.cwd(), ".claude", "claudeclaw", "whisper");
const WHISPER_PATH = join(WHISPER_ROOT, "whisper.cpp");
const MODEL_FOLDER = join(WHISPER_ROOT, "models");
const TMP_FOLDER = join(WHISPER_ROOT, "tmp");
const FFMPEG_CORE_JS = join(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "umd", "ffmpeg-core.js");
const FFMPEG_CORE_WASM = join(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "umd", "ffmpeg-core.wasm");

let warmupPromise: Promise<void> | null = null;
let ffmpegLoadPromise: Promise<void> | null = null;
let ffmpegQueue: Promise<unknown> = Promise.resolve();
const ffmpeg = new FFmpeg();

function enqueueFfmpeg<T>(fn: () => Promise<T>): Promise<T> {
  const task = ffmpegQueue.then(fn, fn);
  ffmpegQueue = task.catch(() => {});
  return task;
}

async function loadFfmpeg(): Promise<void> {
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = ffmpeg
      .load({
        coreURL: pathToFileURL(FFMPEG_CORE_JS).toString(),
        wasmURL: pathToFileURL(FFMPEG_CORE_WASM).toString(),
      })
      .then(() => undefined)
      .catch((err) => {
        ffmpegLoadPromise = null;
        throw err;
      });
  }
  await ffmpegLoadPromise;
}

async function prepareWhisperAssets(printOutput: boolean): Promise<void> {
  await mkdir(WHISPER_ROOT, { recursive: true });
  await mkdir(MODEL_FOLDER, { recursive: true });
  await mkdir(TMP_FOLDER, { recursive: true });

  await installWhisperCpp({
    version: WHISPER_CPP_VERSION,
    to: WHISPER_PATH,
    printOutput,
  });
  await downloadWhisperModel({
    model: WHISPER_MODEL,
    folder: MODEL_FOLDER,
    printOutput,
  });
  await loadFfmpeg();
}

async function ensureWavInput(inputPath: string): Promise<string> {
  if (extname(inputPath).toLowerCase() === ".wav") return inputPath;

  const wavPath = join(TMP_FOLDER, `${basename(inputPath, extname(inputPath))}-${Date.now()}.wav`);
  const sourceExt = extname(inputPath) || ".oga";
  await loadFfmpeg();

  await enqueueFfmpeg(async () => {
    const inputName = `input-${Date.now()}${sourceExt}`;
    const outputName = `output-${Date.now()}.wav`;
    const logs: string[] = [];
    const onLog = ({ type, message }: { type: string; message: string }) => {
      if (type === "fferr" || type === "ffout") logs.push(message);
    };

    ffmpeg.on("log", onLog);
    try {
      const inputBytes = new Uint8Array(await readFile(inputPath));
      await ffmpeg.writeFile(inputName, inputBytes);
      const exitCode = await ffmpeg.exec(["-i", inputName, "-ar", "16000", "-ac", "1", outputName]);
      if (exitCode !== 0) {
        const detail = logs.slice(-5).join(" | ");
        throw new Error(`ffmpeg.wasm conversion failed (exit ${exitCode})${detail ? `: ${detail}` : ""}`);
      }
      const outputBytes = await ffmpeg.readFile(outputName);
      if (!(outputBytes instanceof Uint8Array)) {
        throw new Error("ffmpeg.wasm returned non-binary WAV output");
      }
      await writeFile(wavPath, outputBytes);
    } finally {
      ffmpeg.off("log", onLog);
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    }
  });

  return wavPath;
}

export function warmupWhisperAssets(options?: { printOutput?: boolean }): Promise<void> {
  const printOutput = options?.printOutput ?? false;
  if (!warmupPromise) {
    warmupPromise = prepareWhisperAssets(printOutput).catch((err) => {
      warmupPromise = null;
      throw err;
    });
  }
  return warmupPromise;
}

export async function transcribeAudioToText(inputPath: string): Promise<string> {
  await warmupWhisperAssets();

  const wavPath = await ensureWavInput(inputPath);
  const shouldCleanup = wavPath !== inputPath;
  try {
    const result = await transcribe({
      inputPath: wavPath,
      model: WHISPER_MODEL,
      modelFolder: MODEL_FOLDER,
      whisperCppVersion: WHISPER_CPP_VERSION,
      whisperPath: WHISPER_PATH,
      tokenLevelTimestamps: false,
      printOutput: false,
      language: null,
    });

    return result.transcription
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } finally {
    if (shouldCleanup) {
      await rm(wavPath, { force: true }).catch(() => {});
    }
  }
}
