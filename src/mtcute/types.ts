export interface TargetChat {
  id: number;
  title: string;
  type: "user" | "group" | "supergroup" | "channel";
  username?: string;
  addedAt: string;
  lastSummaryAt?: string;
  trackingEnabled: boolean;
  description?: string;
}

export interface TargetChatsStore {
  chats: TargetChat[];
  updatedAt: string;
}

export interface ChatNote {
  chatId: number;
  chatTitle: string;
  timestamp: string;
  content: string;
  source: "auto" | "manual";
  tags?: string[];
}

export interface FormattedMessage {
  date: Date;
  senderName: string;
  text: string;
  media?: string;
}
