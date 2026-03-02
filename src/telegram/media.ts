import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import type { TelegramFile, TelegramMessage } from "./types";
import { callApi, FILE_API_BASE } from "./api";
import {
  debugLog,
  extensionFromAudioMimeType,
  extensionFromMimeType,
  isAudioDocument,
  isGenericDocument,
  isImageDocument,
  pickLargestPhoto,
} from "./utils";

export async function downloadImageFromMessage(token: string, message: TelegramMessage): Promise<string | null> {
  const photo = message.photo && message.photo.length > 0 ? pickLargestPhoto(message.photo) : null;
  const imageDocument = isImageDocument(message.document) ? message.document : null;
  const fileId = photo?.file_id ?? imageDocument?.file_id;
  if (!fileId) return null;

  const fileMeta = await callApi<{ ok: boolean; result: TelegramFile }>(token, "getFile", { file_id: fileId });
  if (!fileMeta.ok || !fileMeta.result.file_path) return null;

  const remotePath = fileMeta.result.file_path;
  const downloadUrl = `${FILE_API_BASE}${token}/${remotePath}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Telegram file download failed: ${response.status} ${response.statusText}`);

  const dir = join(process.cwd(), ".claude", "claudeclaw", "inbox", "telegram");
  await mkdir(dir, { recursive: true });

  const remoteExt = extname(remotePath);
  const docExt = extname(imageDocument?.file_name ?? "");
  const mimeExt = extensionFromMimeType(imageDocument?.mime_type);
  const ext = remoteExt || docExt || mimeExt || ".jpg";
  const filename = `${message.chat.id}-${message.message_id}-${Date.now()}${ext}`;
  const localPath = join(dir, filename);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await Bun.write(localPath, bytes);
  return localPath;
}

export async function downloadVoiceFromMessage(token: string, message: TelegramMessage): Promise<string | null> {
  const audioDocument = isAudioDocument(message.document) ? message.document : null;
  const audioLike = message.voice ?? message.audio ?? audioDocument;
  const fileId = audioLike?.file_id;
  if (!fileId) return null;

  const fileMeta = await callApi<{ ok: boolean; result: TelegramFile }>(token, "getFile", { file_id: fileId });
  if (!fileMeta.ok || !fileMeta.result.file_path) return null;

  const remotePath = fileMeta.result.file_path;
  const downloadUrl = `${FILE_API_BASE}${token}/${remotePath}`;
  debugLog(
    `Voice download: fileId=${fileId} remotePath=${remotePath} mime=${audioLike.mime_type ?? "unknown"} expectedSize=${audioLike.file_size ?? "unknown"}`
  );
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Telegram file download failed: ${response.status} ${response.statusText}`);

  const dir = join(process.cwd(), ".claude", "claudeclaw", "inbox", "telegram");
  await mkdir(dir, { recursive: true });

  const remoteExt = extname(remotePath);
  const docExt = extname(message.document?.file_name ?? "");
  const audioExt = extname(message.audio?.file_name ?? "");
  const mimeExt = extensionFromAudioMimeType(audioLike.mime_type);
  const ext = remoteExt || docExt || audioExt || mimeExt || ".ogg";
  const filename = `${message.chat.id}-${message.message_id}-${Date.now()}${ext}`;
  const localPath = join(dir, filename);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await Bun.write(localPath, bytes);
  const header = Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  const oggMagic =
    bytes.length >= 4 &&
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53;
  debugLog(
    `Voice download: wrote ${bytes.length} bytes to ${localPath} ext=${ext} header=${header || "empty"} oggMagic=${oggMagic}`
  );
  return localPath;
}

export async function downloadDocumentFromMessage(token: string, message: TelegramMessage): Promise<string | null> {
  const doc = isGenericDocument(message.document) ? message.document : null;
  if (!doc) return null;

  const fileMeta = await callApi<{ ok: boolean; result: TelegramFile }>(token, "getFile", { file_id: doc.file_id });
  if (!fileMeta.ok || !fileMeta.result.file_path) return null;

  const remotePath = fileMeta.result.file_path;
  const downloadUrl = `${FILE_API_BASE}${token}/${remotePath}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Telegram file download failed: ${response.status} ${response.statusText}`);

  const dir = join(process.cwd(), ".claude", "claudeclaw", "inbox", "telegram");
  await mkdir(dir, { recursive: true });

  const ext = extname(doc.file_name ?? "") || extname(remotePath) || "";
  const filename = `${message.chat.id}-${message.message_id}-${Date.now()}${ext}`;
  const localPath = join(dir, filename);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await Bun.write(localPath, bytes);
  debugLog(`Document download: wrote ${bytes.length} bytes to ${localPath} name=${doc.file_name ?? "unknown"} mime=${doc.mime_type ?? "unknown"}`);
  return localPath;
}

export async function transcribeVoice(filePath: string): Promise<string> {
  const sttUrl = process.env.STT_URL;
  if (!sttUrl) throw new Error("STT_URL not configured");
  const form = new FormData();
  form.append("file", Bun.file(filePath));
  form.append("temperature", "0.0");
  form.append("response_format", "json");
  const res = await fetch(`${sttUrl}/inference`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`STT error: ${res.status}`);
  const data = (await res.json()) as { text: string };
  return data.text.trim();
}
