import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
  ChatMessageList,
  ChatInput,
} from "@/components/chat";
import type { ChatMessage, ConnectionStatus } from "@/lib/types";
import { Send, RefreshCw, Loader2, AlertCircle } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  connectionStatus: ConnectionStatus;
  isLoading?: boolean;
  onSendMessage: (text: string) => void;
  onRetryMessage?: (messageId: string) => void;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAvatarFallback(role: ChatMessage["role"]): string {
  switch (role) {
    case "user":
      return "U";
    case "assistant":
      return "AI";
    case "system":
      return "S";
  }
}

function getStatusIcon(status: ChatMessage["status"]) {
  switch (status) {
    case "sending":
      return <Loader2 className="size-3 animate-spin text-muted-foreground" />;
    case "streaming":
      return <Loader2 className="size-3 animate-pulse text-muted-foreground" />;
    case "failed":
      return <AlertCircle className="size-3 text-destructive" />;
    default:
      return null;
  }
}

export function ChatPanel({
  messages,
  connectionStatus,
  isLoading = false,
  onSendMessage,
  onRetryMessage,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isConnected = connectionStatus === "connected";

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (trimmed && isConnected) {
      onSendMessage(trimmed);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Chat</CardTitle>
          <Badge variant="outline" className="text-xs">
            {messages.length} messages
          </Badge>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-0 flex flex-col min-h-0">
        <div className="flex-1 min-h-0" ref={scrollRef}>
          <ChatMessageList className="h-full">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                {isConnected
                  ? "No messages yet. Start the conversation!"
                  : "Connect to start chatting"}
              </div>
            ) : (
              messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  variant={message.role === "user" ? "sent" : "received"}
                >
                  <ChatBubbleAvatar fallback={getAvatarFallback(message.role)} />
                  <div className="flex flex-col gap-1">
                    <ChatBubbleMessage
                      variant={message.role === "user" ? "sent" : "received"}
                      className={message.status === "failed" ? "opacity-70" : ""}
                    >
                      {message.text}
                    </ChatBubbleMessage>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      {message.role === "user" && getStatusIcon(message.status)}
                      {message.status === "failed" && onRetryMessage && (
                        <button
                          onClick={() => onRetryMessage(message.id)}
                          className="flex items-center gap-1 text-xs text-destructive hover:underline"
                        >
                          <RefreshCw className="size-3" />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                </ChatBubble>
              ))
            )}
            {isLoading && (
              <ChatBubble variant="received">
                <ChatBubbleAvatar fallback="AI" />
                <ChatBubbleMessage isLoading variant="received" />
              </ChatBubble>
            )}
          </ChatMessageList>
        </div>

        <Separator />

        <form
          className="p-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="flex gap-2 items-end">
            <div className="flex-1 rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
              <ChatInput
                placeholder={
                  isConnected
                    ? "Type a message..."
                    : "Connect to send messages"
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!isConnected}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || !isConnected}
            >
              <Send className="size-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
