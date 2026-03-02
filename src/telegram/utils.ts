import type { TelegramDocument, TelegramMessage, TelegramPhotoSize } from "./types";
import { telegramDebug } from "./state";

export function debugLog(message: string): void {
  if (!telegramDebug) return;
  console.log(`[Telegram][debug] ${message}`);
}

export function normalizeTelegramText(text: string): string {
  return text.replace(/[\u2010-\u2015\u2212]/g, "-");
}

export function getMessageTextAndEntities(message: TelegramMessage): {
  text: string;
  entities: TelegramMessage["entities"];
} {
  if (message.text) {
    return {
      text: normalizeTelegramText(message.text),
      entities: message.entities,
    };
  }

  if (message.caption) {
    return {
      text: normalizeTelegramText(message.caption),
      entities: message.caption_entities,
    };
  }

  return { text: "", entities: [] };
}

export function isImageDocument(document?: TelegramDocument): boolean {
  return Boolean(document?.mime_type?.startsWith("image/"));
}

export function isAudioDocument(document?: TelegramDocument): boolean {
  return Boolean(document?.mime_type?.startsWith("audio/"));
}

export function isGenericDocument(document?: TelegramDocument): boolean {
  if (!document) return false;
  if (isImageDocument(document)) return false;
  if (isAudioDocument(document)) return false;
  return true;
}

export function pickLargestPhoto(photo: TelegramPhotoSize[]): TelegramPhotoSize {
  return [...photo].sort((a, b) => {
    const sizeA = a.file_size ?? a.width * a.height;
    const sizeB = b.file_size ?? b.width * b.height;
    return sizeB - sizeA;
  })[0];
}

export function extensionFromMimeType(mimeType?: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/bmp":
      return ".bmp";
    default:
      return "";
  }
}

export function extensionFromAudioMimeType(mimeType?: string): string {
  switch (mimeType) {
    case "audio/mpeg":
      return ".mp3";
    case "audio/mp4":
    case "audio/x-m4a":
      return ".m4a";
    case "audio/ogg":
      return ".ogg";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    case "audio/webm":
      return ".webm";
    default:
      return "";
  }
}

export function extractTelegramCommand(text: string): string | null {
  const firstToken = text.trim().split(/\s+/, 1)[0];
  if (!firstToken.startsWith("/")) return null;
  return firstToken.split("@", 1)[0].toLowerCase();
}
