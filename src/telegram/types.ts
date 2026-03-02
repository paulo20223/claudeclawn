import type { WebSnapshot } from "../ui/types";

export interface TelegramContext {
  getSnapshot: () => WebSnapshot;
  runJob: (jobName: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
}

export interface CommandResult {
  text: string;
  buttons?: InlineButton[][];
}

export const COMMAND_MENU = [
  { command: "menu", description: "Быстрые действия" },
  { command: "today_tasks", description: "Задачи на сегодня" },
  { command: "clear", description: "Сброс сессии" },
];

// --- Bot API types ---

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  reply_to_message?: { from?: TelegramUser };
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  sticker?: TelegramSticker;
  entities?: Array<{
    type: "mention" | "bot_command" | string;
    offset: number;
    length: number;
  }>;
  caption_entities?: Array<{
    type: "mention" | "bot_command" | string;
    offset: number;
    length: number;
  }>;
}

export interface TelegramPhotoSize {
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  mime_type?: string;
  duration?: number;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  mime_type?: string;
  duration?: number;
  file_name?: string;
  file_size?: number;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  type: "regular" | "mask" | "custom_emoji";
  width: number;
  height: number;
  emoji?: string;
  set_name?: string;
}

export interface TelegramChatMember {
  user: TelegramUser;
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
}

export interface TelegramMyChatMemberUpdate {
  chat: { id: number; type: string; title?: string };
  from: TelegramUser;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  my_chat_member?: TelegramMyChatMemberUpdate;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMe {
  id: number;
  username?: string;
  can_read_all_group_messages?: boolean;
}

export interface TelegramFile {
  file_path?: string;
}

export interface PendingAsk {
  options: string[];
  createdAt: number;
}

export interface PendingRequest {
  messageId: number;
  controller: AbortController;
}

export type InlineButton = { text: string; callback_data: string };
