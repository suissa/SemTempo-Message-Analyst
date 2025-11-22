import { IMessage } from "./types";

export function formatConversation(messages: IMessage[]): string {
  const start = messages[0]?.timestamp ?? 0;

  return messages
    .map(m => {
      const diff = Math.round((m.timestamp - start) / 1000);
      const min = Math.floor(diff / 60).toString().padStart(2, "0");
      const sec = (diff % 60).toString().padStart(2, "0");
      return `[${min}:${sec}] [${m.role.toUpperCase()}] ${m.text}`;
    })
    .join("\n");
} 
