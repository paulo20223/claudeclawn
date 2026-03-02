import { initConfig, loadSettings, type MtcuteConfig } from "../config";

export async function mtcute(args: string[]) {
  await initConfig();
  const settings = await loadSettings();
  const config = settings.mtcute;

  const subcommand = args[0];

  if (subcommand === "auth") {
    const { runAuthFlow } = await import("../mtcute/auth");
    await runAuthFlow(config);
    return;
  }

  if (subcommand === "status") {
    await showStatus(config);
    return;
  }

  if (subcommand === "chats") {
    await handleChats(args.slice(1), config);
    return;
  }

  if (subcommand === "summary") {
    const chatId = Number(args[1]);
    if (!chatId) {
      console.error("Usage: claudeclaw mtcute summary <chatId> [limit]");
      process.exit(1);
    }
    const limit = Number(args[2]) || 100;
    await ensureGateway(config);
    const { generateChatSummary } = await import("../mtcute/summary");
    console.log(`Generating summary for chat ${chatId} (last ${limit} messages)...`);
    const result = await generateChatSummary(chatId, limit);
    console.log(result.stdout);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return;
  }

  if (subcommand === "reply") {
    const chatId = Number(args[1]);
    if (!chatId) {
      console.error("Usage: claudeclaw mtcute reply <chatId> [--send]");
      process.exit(1);
    }
    const autoSend = args.includes("--send");
    await ensureGateway(config);
    const { generateReply } = await import("../mtcute/reply");
    console.log(`Generating reply for chat ${chatId}...`);
    const { runResult, suggestedReply, sent } = await generateReply(chatId, 30, autoSend);
    if (runResult.exitCode !== 0) {
      console.error(`Error: ${runResult.stderr}`);
      process.exit(runResult.exitCode);
    }
    if (sent) {
      console.log("Reply sent:");
    } else {
      console.log("Suggested reply (not sent):");
    }
    console.log(suggestedReply);
    return;
  }

  if (subcommand === "notes") {
    const chatId = args[1] ? Number(args[1]) : undefined;
    const { listNotes, listAllNotes } = await import("../mtcute/notes");
    const notes = chatId ? await listNotes(chatId) : await listAllNotes();
    if (notes.length === 0) {
      console.log("No notes found.");
      return;
    }
    for (const note of notes) {
      console.log(`\n--- ${note.chatTitle} [${note.timestamp}] (${note.source}) ---`);
      if (note.tags?.length) console.log(`Tags: ${note.tags.join(", ")}`);
      console.log(note.content);
    }
    return;
  }

  // Show help
  console.log("Usage: claudeclaw mtcute <command>");
  console.log("");
  console.log("Commands:");
  console.log("  auth                     Interactive authentication");
  console.log("  status                   Connection status");
  console.log("  chats                    List target chats");
  console.log("  chats search <query>     Search dialogs");
  console.log("  chats add <chatId>       Add target chat");
  console.log("  chats remove <chatId>    Remove target chat");
  console.log("  summary <chatId> [limit] Generate chat summary");
  console.log("  reply <chatId> [--send]  Generate (and optionally send) reply");
  console.log("  notes [chatId]           View tracking notes");
}

async function ensureGateway(config: MtcuteConfig): Promise<void> {
  const { isGatewayConnected } = await import("../mtcute/gateway");
  const ok = await isGatewayConnected();
  if (!ok) {
    console.error("mtcute gateway is not available. Make sure the mtcute container is running.");
    process.exit(1);
  }
}

async function showStatus(config: MtcuteConfig): Promise<void> {
  console.log("mtcute status:");
  console.log(`  Enabled: ${config.enabled}`);
  console.log(`  Gateway: ${config.gatewayUrl}`);
  console.log(`  Tracking: ${config.trackingEnabled ? `every ${config.trackingInterval}m` : "disabled"}`);

  const { isGatewayConnected } = await import("../mtcute/gateway");
  const connected = await isGatewayConnected();
  console.log(`  Gateway connected: ${connected}`);

  const { listTargetChats } = await import("../mtcute/chats");
  const chats = await listTargetChats();
  console.log(`  Target chats: ${chats.length}`);
  for (const chat of chats) {
    const tracking = chat.trackingEnabled ? " [tracking]" : "";
    console.log(`    - ${chat.title} (${chat.id})${tracking}`);
  }
}

async function handleChats(args: string[], config: MtcuteConfig): Promise<void> {
  const action = args[0];

  if (action === "search") {
    const query = args.slice(1).join(" ");
    if (!query) {
      console.error("Usage: claudeclaw mtcute chats search <query>");
      process.exit(1);
    }
    await ensureGateway(config);
    const { searchDialogs } = await import("../mtcute/chats");
    console.log(`Searching for "${query}"...`);
    const results = await searchDialogs(query);
    if (results.length === 0) {
      console.log("No dialogs found.");
    } else {
      for (const chat of results) {
        const username = chat.username ? ` @${chat.username}` : "";
        console.log(`  ${chat.id} | ${chat.type} | ${chat.title}${username}`);
      }
    }
    return;
  }

  if (action === "add") {
    const chatId = Number(args[1]);
    if (!chatId) {
      console.error("Usage: claudeclaw mtcute chats add <chatId>");
      process.exit(1);
    }
    await ensureGateway(config);
    const { getChatInfoViaGateway } = await import("../mtcute/gateway");
    try {
      const chat = await getChatInfoViaGateway(chatId);
      const { addTargetChat } = await import("../mtcute/chats");
      const added = await addTargetChat({
        id: chat.id,
        title: chat.title,
        type: chat.type as "user" | "group" | "supergroup" | "channel",
        username: chat.username,
      });

      if (added) {
        console.log(`Added: ${chat.title} (${chat.id})`);
      } else {
        console.log(`Already exists: ${chat.title} (${chat.id})`);
      }
    } catch (err) {
      console.error(`Failed to resolve chat ${chatId}: ${err instanceof Error ? err.message : err}`);
    }
    return;
  }

  if (action === "remove") {
    const chatId = Number(args[1]);
    if (!chatId) {
      console.error("Usage: claudeclaw mtcute chats remove <chatId>");
      process.exit(1);
    }
    const { removeTargetChat } = await import("../mtcute/chats");
    const removed = await removeTargetChat(chatId);
    console.log(removed ? `Removed chat ${chatId}` : `Chat ${chatId} not found`);
    return;
  }

  // Default: list target chats
  const { listTargetChats } = await import("../mtcute/chats");
  const chats = await listTargetChats();
  if (chats.length === 0) {
    console.log("No target chats configured.");
    console.log("Use 'claudeclaw mtcute chats search <query>' to find chats.");
    return;
  }
  for (const chat of chats) {
    const tracking = chat.trackingEnabled ? " [tracking]" : "";
    const lastSummary = chat.lastSummaryAt ? ` (last summary: ${chat.lastSummaryAt})` : "";
    console.log(`  ${chat.id} | ${chat.type} | ${chat.title}${tracking}${lastSummary}`);
  }
}
