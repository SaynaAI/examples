# Sayna React Voice Chat Example

A React + TypeScript + Vite example demonstrating real-time voice chat using the [Sayna JS SDK](../../saysdk/js-sdk/README.md) and LiveKit data messaging.

## Overview

This example is a **client-only** application that connects to a LiveKit room via the Sayna JS SDK. It requires a separate backend service to generate LiveKit access tokens.

### Architecture

```
┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
│   React Frontend   │  POST   │   Your Backend     │  REST   │   Sayna Server     │
│   (this example)   │────────>│   Token Endpoint   │────────>│   /livekit/token   │
│                    │         │                    │         │                    │
└─────────┬──────────┘         └────────────────────┘         └────────────────────┘
          │
          │ WebSocket
          │ (LiveKit)
          ▼
┌────────────────────┐
│   LiveKit Server   │
│   (audio + data)   │
└────────────────────┘
```

**Key point**: The browser uses LiveKit only. Sayna's WebSocket API (`/ws`) is server-to-server and not used in this client application.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

### Environment Variables

Create a `.env` file in this directory:

```bash
# Required: Your backend token endpoint URL
API_ENDPOINT=https://your-backend.example.com/api/token
```

The `API_ENDPOINT` must point to your backend service that generates LiveKit tokens.

### Token Endpoint Requirements

Your backend token endpoint must:

1. Accept a POST request with this JSON body:
   ```json
   {
     "room_name": "my-room",
     "participant_name": "John Doe",
     "participant_identity": "user-123"
   }
   ```

2. Call the Sayna API's `POST /livekit/token` endpoint

3. Return a response with `token` and `liveUrl`:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "liveUrl": "wss://livekit.example.com"
   }
   ```

**Important**: The Sayna REST API returns `livekit_url` (snake_case), but the JS SDK expects `liveUrl` (camelCase). Your backend must map this field:

```javascript
// In your backend
const saynaResponse = await fetch('https://sayna-api/livekit/token', { ... });
const data = await saynaResponse.json();

// Map livekit_url to liveUrl for the JS SDK
return {
  token: data.token,
  liveUrl: data.livekit_url  // <-- Mapping here
};
```

The example code in `src/lib/saynaClient.ts` handles this mapping automatically for direct Sayna API responses:

```typescript
const tokenResponse: TokenResponse = {
  token: data.token,
  liveUrl: data.livekit_url || data.liveUrl,  // Accept either format
};
```

## Connection Modes

This example provides two ways to connect:

### Start Chat (Text Only)

- Connects to the LiveKit room **without** microphone access
- Chat messages are sent/received via LiveKit data channels
- Suitable for text-based interactions with AI agents or other participants
- Lower permission requirements (no microphone prompt)

### Call (Audio + Chat)

- Connects to the LiveKit room **with** microphone publishing
- Full voice communication plus chat messaging
- Browser will prompt for microphone permission
- Audio from remote participants plays through the hidden `<audio>` element

## Features

### LiveKit Data Messaging

Chat messages are sent over LiveKit's data channel with this schema:

```typescript
interface DataChannelMessage {
  message: string;      // The text content
  topic: string;        // Routing key (e.g., "chat", "status")
  role: "user" | "ai";  // Message sender role
  timestamp?: number;   // Unix timestamp in milliseconds
}
```

The `topic` field enables message routing:
- `"chat"` - Main conversation messages (displayed in chat UI)
- `"status"` - Status updates (displayed as system messages)
- Other topics are ignored (extend as needed)

### Audio Playback

Remote audio is automatically attached to a hidden `<audio>` element. If the browser blocks autoplay, a banner appears prompting the user to enable audio.

### Error Handling

The UI displays clear error messages for:
- Token fetch failures (API endpoint issues)
- Network failures (LiveKit connection problems)
- Microphone permission denial
- Message send failures (with retry option)

## Project Structure

```
src/
├── App.tsx                    # Main application component
├── lib/
│   ├── saynaClient.ts         # SaynaClient wrapper with token handling
│   └── types.ts               # TypeScript interfaces
└── components/
    ├── connection-panel.tsx   # Room config and connection controls
    └── chat-panel.tsx         # Message list and input
```

## Best Practices

### SDK Usage

1. **Connect on user action only**
   - Never auto-connect on page load
   - Always wait for explicit user interaction (button click)
   - This avoids permission prompts before the user is ready

2. **Always disconnect on unmount**
   ```typescript
   useEffect(() => {
     return () => {
       if (clientRef.current) {
         clientRef.current.disconnect();
         clientRef.current = null;
       }
     };
   }, []);
   ```

3. **Handle microphone permission errors gracefully**
   - Catch errors from `publishMicrophone()`
   - Display a clear message explaining what happened
   - Allow the user to retry or continue without audio

4. **Use HTTPS for token endpoints**
   - Never expose API keys in browser code
   - All token generation must happen server-side
   - Serve your app over HTTPS in production

### Data Messaging

1. **Keep messages small**
   - LiveKit data channels have size limits
   - Use concise payloads (< 16KB recommended)

2. **Use topics for routing**
   - Separate concerns with different topic values
   - Makes it easy to filter and handle different message types

3. **Include timestamps**
   - Helps with message ordering
   - Useful for debugging and analytics

### LiveKit vs Sayna WebSocket

- **Browser apps**: Use LiveKit via the JS SDK (this example)
- **Server apps**: Use Sayna's WebSocket API (`/ws`) for STT/TTS processing

The browser never connects directly to Sayna's WebSocket endpoint. All voice processing happens server-side.

## QA Checklist

Use this checklist for manual verification:

### Connection Flow

- [ ] **Start Chat** connects without microphone prompt
- [ ] **Call** prompts for microphone permission
- [ ] Connection status badge updates correctly (idle → connecting → connected)
- [ ] **Disconnect** cleanly returns to idle state
- [ ] Error states display clear messages

### Microphone

- [ ] Mic toggle enables/disables microphone when connected
- [ ] Denying permission shows appropriate error message
- [ ] Mic status badge reflects current state (off/starting/on/error)

### Audio Playback

- [ ] Remote audio plays when participants speak
- [ ] Blocked playback shows banner with "Click to enable audio" button
- [ ] Clicking the banner enables audio playback

### Chat Messaging

- [ ] Messages send successfully when connected
- [ ] Received messages appear in chat list with correct role (user/assistant/system)
- [ ] Failed messages show retry option
- [ ] Retry successfully resends the message
- [ ] Sending disabled when not connected
- [ ] Timestamps display correctly

### Error Handling

- [ ] Token fetch failure shows clear error
- [ ] Network disconnection updates status and shows message
- [ ] Invalid room name shows validation error
- [ ] Connection timeout handled gracefully

### Browser Compatibility

- [ ] Chrome: Full functionality
- [ ] Firefox: Full functionality
- [ ] Safari: Audio playback may require user gesture
- [ ] Edge: Full functionality

## References

- [Sayna JS SDK Documentation](../../saysdk/js-sdk/README.md)
- [JS SDK Best Practices](../.cursor/rules/js-sdk.mdc)
- [Sayna API Reference](../../sayna/docs/api-reference.md)
- [LiveKit Integration Guide](../../sayna/docs/livekit_integration.md)
- [Examples CLAUDE.md](../CLAUDE.md)
