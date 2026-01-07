export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export type MicStatus = "off" | "starting" | "on" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: number;
  senderId?: string;
  topic?: string;
  status?: "sending" | "sent" | "failed" | "streaming";
  delivery?: "reliable" | "lossy";
}

/**
 * Schema for messages sent/received over LiveKit data channel.
 * topic defaults to "chat" for main chat messages.
 */
export interface DataChannelMessage {
  message: string;
  topic: string;
  role: "user" | "ai";
  timestamp?: number;
  identity?: string;
  isFinal?: boolean;
  interim?: boolean;
}

export interface ConnectionConfig {
  roomName: string;
  participantName: string;
  participantIdentity: string;
}
