import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ConnectionStatus, MicStatus, ConnectionConfig } from "@/lib/types";
import { MessageCircle, Phone, PhoneOff, Mic, MicOff } from "lucide-react";

interface ConnectionPanelProps {
  config: ConnectionConfig;
  onConfigChange: (config: ConnectionConfig) => void;
  connectionStatus: ConnectionStatus;
  micStatus: MicStatus;
  onStartChat: () => void;
  onCall: () => void;
  onDisconnect: () => void;
  onMicToggle: () => void;
  error?: string | null;
}

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case "idle":
      return "bg-muted text-muted-foreground";
    case "connecting":
      return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    case "connected":
      return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "error":
      return "bg-red-500/20 text-red-700 dark:text-red-400";
  }
}

function getMicStatusColor(status: MicStatus): string {
  switch (status) {
    case "off":
      return "bg-muted text-muted-foreground";
    case "starting":
      return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    case "on":
      return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "error":
      return "bg-red-500/20 text-red-700 dark:text-red-400";
  }
}

export function ConnectionPanel({
  config,
  onConfigChange,
  connectionStatus,
  micStatus,
  onStartChat,
  onCall,
  onDisconnect,
  onMicToggle,
  error,
}: ConnectionPanelProps) {
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const canConnect = connectionStatus === "idle" || connectionStatus === "error";

  const handleInputChange = (field: keyof ConnectionConfig) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onConfigChange({ ...config, [field]: e.target.value });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Connection</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className={getStatusColor(connectionStatus)}>
              {connectionStatus}
            </Badge>
            {isConnected && (
              <Badge variant="outline" className={getMicStatusColor(micStatus)}>
                mic: {micStatus}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 pt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="roomName">Room Name</Label>
          <Input
            id="roomName"
            placeholder="my-voice-room"
            value={config.roomName}
            onChange={handleInputChange("roomName")}
            disabled={isConnected || isConnecting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="participantName">Display Name</Label>
          <Input
            id="participantName"
            placeholder="John Doe"
            value={config.participantName}
            onChange={handleInputChange("participantName")}
            disabled={isConnected || isConnecting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="participantIdentity">Identity</Label>
          <Input
            id="participantIdentity"
            placeholder="user-123"
            value={config.participantIdentity}
            onChange={handleInputChange("participantIdentity")}
            disabled={isConnected || isConnecting}
          />
        </div>

        <Separator className="my-4" />

        {canConnect ? (
          <div className="flex flex-col gap-2">
            <Button
              onClick={onStartChat}
              variant="outline"
              className="w-full justify-start"
              disabled={!config.roomName}
            >
              <MessageCircle className="mr-2 size-4" />
              Start Chat
            </Button>
            <Button
              onClick={onCall}
              variant="default"
              className="w-full justify-start"
              disabled={!config.roomName}
            >
              <Phone className="mr-2 size-4" />
              Call
            </Button>
          </div>
        ) : isConnecting ? (
          <div className="flex flex-col gap-2">
            <Button disabled variant="outline" className="w-full">
              Connecting...
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              onClick={onMicToggle}
              variant={micStatus === "on" ? "default" : "outline"}
              className="w-full justify-start"
              disabled={micStatus === "starting"}
            >
              {micStatus === "on" ? (
                <>
                  <MicOff className="mr-2 size-4" />
                  Mute Microphone
                </>
              ) : (
                <>
                  <Mic className="mr-2 size-4" />
                  Enable Microphone
                </>
              )}
            </Button>
            <Button
              onClick={onDisconnect}
              variant="destructive"
              className="w-full justify-start"
            >
              <PhoneOff className="mr-2 size-4" />
              Disconnect
            </Button>
          </div>
        )}
      </CardContent>

      {error && (
        <CardFooter className="pt-0">
          <div className="w-full p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
