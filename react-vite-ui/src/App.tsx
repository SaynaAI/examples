import { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConnectionPanel } from "@/components/connection-panel";
import { ChatPanel } from "@/components/chat-panel";
import type {
  ConnectionStatus,
  MicStatus,
  ChatMessage,
  ConnectionConfig,
  DataChannelMessage,
} from "@/lib/types";
import type { SaynaClient } from "@sayna-ai/js-sdk";
import {
  createSaynaClient,
  tryPlayAudio,
  TokenFetchError,
} from "@/lib/saynaClient";
import {
  RoomEvent,
  DataPacket_Kind,
  type RemoteParticipant,
  type Room,
} from "livekit-client";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_MIC_OPTIONS = {
  noiseSuppression: true,
  echoCancellation: true,
};

function App() {
  // Connection configuration
  const [config, setConfig] = useState<ConnectionConfig>({
    roomName: "",
    participantName: "",
    participantIdentity: "",
  });

  // Connection and mic state
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [micStatus, setMicStatus] = useState<MicStatus>("off");
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  // Playback restriction state
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  // Audio element ref for SaynaClient
  const audioRef = useRef<HTMLAudioElement>(null);

  // SaynaClient ref (persists across renders)
  const clientRef = useRef<SaynaClient | null>(null);

  // Track if an action is in flight to prevent double operations
  const actionInFlightRef = useRef(false);

  // Add a message to the chat
  const addMessage = useCallback(
    (role: ChatMessage["role"], text: string, senderId?: string) => {
      const message: ChatMessage = {
        id: generateId(),
        role,
        text,
        timestamp: Date.now(),
        senderId,
      };
      setMessages((prev) => [...prev, message]);
      return message;
    },
    []
  );

  /**
   * Shared connect logic for both Start Chat and Call flows.
   * @param withAudio - If true, publishes microphone after connecting
   */
  const connect = useCallback(
    async (withAudio: boolean) => {
      if (actionInFlightRef.current) return;
      actionInFlightRef.current = true;

      setError(null);
      setConnectionStatus("connecting");
      if (withAudio) {
        setMicStatus("starting");
      }
      setPlaybackBlocked(false);

      try {
        // Create a new client for this connection
        const client = createSaynaClient({
          config,
          audioElement: audioRef.current,
        });
        clientRef.current = client;

        // Connect to LiveKit
        await client.connect();

        setConnectionStatus("connected");

        // Check if audio playback is allowed
        const playbackOk = await tryPlayAudio(audioRef.current);
        if (!playbackOk) {
          setPlaybackBlocked(true);
        }

        if (withAudio) {
          // Publish microphone for Call flow
          try {
            await client.publishMicrophone(DEFAULT_MIC_OPTIONS);
            setMicStatus("on");
            addMessage("system", "Connected to voice room with microphone enabled");
          } catch (micError) {
            // Handle mic permission denial
            setMicStatus("error");
            const message =
              micError instanceof Error
                ? micError.message
                : "Failed to enable microphone";
            setError(message);
            addMessage("system", `Connected but microphone failed: ${message}`);
          }
        } else {
          addMessage("system", "Connected to chat room");
        }
      } catch (err) {
        // Clean up on error
        clientRef.current = null;
        setConnectionStatus("error");
        setMicStatus("off");

        const message =
          err instanceof TokenFetchError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Connection failed";
        setError(message);
      } finally {
        actionInFlightRef.current = false;
      }
    },
    [config, addMessage]
  );

  // Handle Start Chat (text only, no mic)
  const handleStartChat = useCallback(() => {
    connect(false);
  }, [connect]);

  // Handle Call (with microphone)
  const handleCall = useCallback(() => {
    connect(true);
  }, [connect]);

  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    try {
      if (clientRef.current) {
        await clientRef.current.disconnect();
        clientRef.current = null;
      }
    } catch {
      // Ignore disconnect errors
    }

    setConnectionStatus("idle");
    setMicStatus("off");
    setPlaybackBlocked(false);
    addMessage("system", "Disconnected from room");
    actionInFlightRef.current = false;
  }, [addMessage]);

  // Handle mic toggle
  const handleMicToggle = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.currentRoom) return;

    const localParticipant = client.currentRoom.localParticipant;

    if (micStatus === "off") {
      setMicStatus("starting");
      try {
        await client.publishMicrophone(DEFAULT_MIC_OPTIONS);
        setMicStatus("on");
      } catch (err) {
        setMicStatus("error");
        const message =
          err instanceof Error ? err.message : "Failed to enable microphone";
        setError(message);
      }
    } else if (micStatus === "on") {
      // Use LiveKit API to disable mic
      await localParticipant.setMicrophoneEnabled(false);
      setMicStatus("off");
    }
  }, [micStatus]);

  // Handle enabling audio after user gesture (for autoplay-blocked browsers)
  const handleEnableAudio = useCallback(async () => {
    const played = await tryPlayAudio(audioRef.current);
    if (played) {
      setPlaybackBlocked(false);
    }
  }, []);

  /**
   * Decode and parse incoming data channel message.
   * Returns parsed DataChannelMessage or null if parsing fails.
   */
  const parseDataChannelMessage = useCallback(
    (payload: Uint8Array): DataChannelMessage | null => {
      const decoder = new TextDecoder();

      try {
        const decoded = decoder.decode(payload);
        const parsed = JSON.parse(decoded) as Record<string, unknown>;

        if (typeof parsed.message !== "string") {
          return null;
        }

        const role = parsed.role === "user" ? "user" : "ai";
        const topic =
          typeof parsed.topic === "string" ? parsed.topic : "chat";
        const timestamp =
          typeof parsed.timestamp === "number" ? parsed.timestamp : undefined;
        const identity =
          typeof parsed.identity === "string" ? parsed.identity : undefined;

        const isFinal =
          typeof parsed.is_final === "boolean"
            ? parsed.is_final
            : typeof parsed.isFinal === "boolean"
            ? parsed.isFinal
            : typeof parsed.final === "boolean"
            ? parsed.final
            : undefined;

        const interim =
          typeof parsed.interim === "boolean"
            ? parsed.interim
            : typeof parsed.partial === "boolean"
            ? parsed.partial
            : undefined;

        return {
          message: parsed.message,
          topic,
          role,
          timestamp,
          identity,
          isFinal,
          interim,
        };
      } catch {
        // If JSON parse fails, treat as raw text with default topic
        try {
          const rawText = decoder.decode(payload);
          return {
            message: rawText,
            topic: "chat",
            role: "ai",
          };
        } catch {
          return null;
        }
      }
    },
    []
  );

  /**
   * Handle incoming data channel messages from LiveKit.
   */
  const handleDataReceived = useCallback(
    (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      kind?: DataPacket_Kind,
      topic?: string
    ) => {
      const data = parseDataChannelMessage(payload);
      if (!data) return;

      const messageTopic = topic ?? data.topic;
      const role = data.role === "user" ? "user" : "assistant";
      const senderId = participant?.identity ?? data.identity ?? data.role;
      const delivery =
        kind === DataPacket_Kind.LOSSY ? "lossy" : "reliable";

      if (messageTopic === "chat") {
        const lastMessageTimestamp = data.timestamp ?? Date.now();
        const hasExplicitInterim =
          data.interim === true || data.isFinal === false;
        const hasExplicitFinal =
          data.interim === false || data.isFinal === true;
        const hasExplicitFlag = hasExplicitInterim || hasExplicitFinal;

        const incomingMessage: ChatMessage = {
          id: generateId(),
          role,
          text: data.message,
          timestamp: lastMessageTimestamp,
          senderId,
          topic: messageTopic,
          status: hasExplicitInterim ? "streaming" : "sent",
          delivery,
        };

        setMessages((prev) => {
          if (prev.length === 0) {
            return [incomingMessage];
          }

          const lastIndex = prev.length - 1;
          const lastMessage = prev[lastIndex];
          const sameSender =
            senderId && lastMessage.senderId
              ? senderId === lastMessage.senderId
              : lastMessage.role === role;
          const sameTopic = lastMessage.topic === messageTopic;

          const isTextContinuation =
            lastMessage.text &&
            (data.message.startsWith(lastMessage.text) ||
              lastMessage.text.startsWith(data.message));

          const shouldTreatAsInterim =
            hasExplicitInterim ||
            (!hasExplicitFlag &&
              role === "user" &&
              sameSender &&
              sameTopic &&
              isTextContinuation);

          if (sameSender && sameTopic) {
            if (shouldTreatAsInterim) {
              const updated = [...prev];
              updated[lastIndex] = {
                ...lastMessage,
                ...incomingMessage,
                status: "streaming",
              };
              return updated;
            }

            const shouldFinalizeStreaming =
              hasExplicitFinal ||
              (!hasExplicitFlag &&
                lastMessage.status === "streaming" &&
                data.message === lastMessage.text);

            if (shouldFinalizeStreaming && lastMessage.status === "streaming") {
              const updated = [...prev];
              updated[lastIndex] = {
                ...lastMessage,
                ...incomingMessage,
                status: "sent",
              };
              return updated;
            }
          }

          return [...prev, incomingMessage];
        });

        if (role === "assistant") {
          setIsAssistantLoading(false);
        }
      } else if (messageTopic === "status") {
        addMessage("system", `Status: ${data.message}`);
      }
    },
    [parseDataChannelMessage, addMessage]
  );

  /**
   * Handle participant connected event.
   */
  const handleParticipantConnected = useCallback(
    (participant: RemoteParticipant) => {
      addMessage(
        "system",
        `${participant.identity || "A participant"} joined the room`
      );
    },
    [addMessage]
  );

  /**
   * Handle participant disconnected event.
   */
  const handleParticipantDisconnected = useCallback(
    (participant: RemoteParticipant) => {
      addMessage(
        "system",
        `${participant.identity || "A participant"} left the room`
      );
      setIsAssistantLoading(false);
    },
    [addMessage]
  );

  /**
   * Setup LiveKit room event listeners after connection.
   */
  const setupRoomEventListeners = useCallback(
    (room: Room) => {
      room.on(RoomEvent.DataReceived, handleDataReceived);
      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    },
    [handleDataReceived, handleParticipantConnected, handleParticipantDisconnected]
  );

  /**
   * Cleanup LiveKit room event listeners.
   */
  const cleanupRoomEventListeners = useCallback(
    (room: Room) => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    },
    [handleDataReceived, handleParticipantConnected, handleParticipantDisconnected]
  );

  // Setup/cleanup room event listeners when connection status changes
  useEffect(() => {
    const room = clientRef.current?.currentRoom;

    if (connectionStatus === "connected" && room) {
      setupRoomEventListeners(room);

      return () => {
        cleanupRoomEventListeners(room);
      };
    }
  }, [connectionStatus, setupRoomEventListeners, cleanupRoomEventListeners]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  /**
   * Update a message's status by ID.
   */
  const updateMessageStatus = useCallback(
    (messageId: string, status: ChatMessage["status"]) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg))
      );
    },
    []
  );

  /**
   * Send a chat message over the LiveKit data channel.
   */
  const handleSendMessage = useCallback(
    (text: string, retryMessageId?: string) => {
      const room = clientRef.current?.currentRoom;

      // If retrying, update existing message status
      if (retryMessageId) {
        updateMessageStatus(retryMessageId, "sending");
      }

      // Block sending if not connected
      if (!room) {
        if (!retryMessageId) {
          // Add failed message to UI
          const message: ChatMessage = {
            id: generateId(),
            role: "user",
            text,
            timestamp: Date.now(),
            senderId: config.participantIdentity || "user",
            topic: "chat",
            status: "failed",
          };
          setMessages((prev) => [...prev, message]);
        } else {
          updateMessageStatus(retryMessageId, "failed");
        }
        setError("Not connected to room. Cannot send message.");
        return;
      }

      // Create the message for local display
      const messageId = retryMessageId ?? generateId();
      if (!retryMessageId) {
        const message: ChatMessage = {
          id: messageId,
          role: "user",
          text,
          timestamp: Date.now(),
          senderId: config.participantIdentity || "user",
          topic: "chat",
          status: "sending",
        };
        setMessages((prev) => [...prev, message]);
      }

      // Build the data channel payload
      const payload: DataChannelMessage = {
        message: text,
        topic: "chat",
        role: "user",
        timestamp: Date.now(),
      };

      // Publish to data channel
      try {
        const encoder = new TextEncoder();
        const encodedPayload = encoder.encode(JSON.stringify(payload));

        room.localParticipant
          .publishData(encodedPayload, { reliable: true, topic: "chat" })
          .then(() => {
            updateMessageStatus(messageId, "sent");
            setIsAssistantLoading(true);
          })
          .catch(() => {
            updateMessageStatus(messageId, "failed");
            setError("Failed to send message. Click to retry.");
          });
      } catch {
        updateMessageStatus(messageId, "failed");
        setError("Failed to send message. Click to retry.");
      }
    },
    [config.participantIdentity, updateMessageStatus]
  );

  /**
   * Retry sending a failed message.
   */
  const handleRetryMessage = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (message && message.status === "failed") {
        handleSendMessage(message.text, messageId);
      }
    },
    [messages, handleSendMessage]
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex-none border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Sayna Voice Chat</h1>
            <Badge
              variant="outline"
              className={
                connectionStatus === "connected"
                  ? "bg-green-500/20 text-green-700 dark:text-green-400"
                  : connectionStatus === "connecting"
                  ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                  : ""
              }
            >
              {connectionStatus}
            </Badge>
          </div>
          {config.roomName && connectionStatus === "connected" && (
            <span className="text-sm text-muted-foreground">
              Room: {config.roomName}
            </span>
          )}
        </div>
      </header>

      <Separator />

      {/* Playback blocked banner */}
      {playbackBlocked && connectionStatus === "connected" && (
        <div className="flex-none bg-yellow-500/20 border-b border-yellow-500/30 px-6 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-yellow-700 dark:text-yellow-400">
              Audio playback is blocked by your browser.
            </span>
            <button
              onClick={handleEnableAudio}
              className="text-sm font-medium text-yellow-700 dark:text-yellow-400 hover:underline"
            >
              Click to enable audio
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex min-h-0">
        {/* Connection panel */}
        <aside className="w-80 flex-none border-r p-4">
          <ConnectionPanel
            config={config}
            onConfigChange={setConfig}
            connectionStatus={connectionStatus}
            micStatus={micStatus}
            onStartChat={handleStartChat}
            onCall={handleCall}
            onDisconnect={handleDisconnect}
            onMicToggle={handleMicToggle}
            error={error}
          />
        </aside>

        {/* Chat panel */}
        <section className="flex-1 p-4 min-w-0">
          <ChatPanel
            messages={messages}
            connectionStatus={connectionStatus}
            isLoading={isAssistantLoading}
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
          />
        </section>
      </main>

      {/* Hidden audio element for SaynaClient playback */}
      <audio ref={audioRef} autoPlay className="hidden" />
    </div>
  );
}

export default App;
