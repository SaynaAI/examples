# Sayna React Voice Chat

A React + TypeScript + Vite frontend for real-time voice conversations using the [Sayna JS SDK](https://github.com/saynaai/saysdk/tree/main/js-sdk).

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              Browser                                        │
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     │
│   │ Connection      │     │ Chat Panel       │     │ Audio           │     │
│   │ Panel           │     │                  │     │ Playback        │     │
│   │                 │     │  Messages        │     │                 │     │
│   │ [Room Name]     │     │  ┌──────────┐   │     │  <audio>        │     │
│   │ [Your Name]     │     │  │ User: Hi │   │     │  element        │     │
│   │                 │     │  │ AI: Hello│   │     │                 │     │
│   │ [Call] [Hang Up]│     │  └──────────┘   │     │                 │     │
│   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘     │
│            │                       │                       │              │
│            └───────────────────────┼───────────────────────┘              │
│                                    │                                       │
│                          ┌─────────▼─────────┐                            │
│                          │   Sayna JS SDK    │                            │
│                          │   (SaynaClient)   │                            │
│                          └─────────┬─────────┘                            │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  Backend     │ │  LiveKit     │ │  Sayna       │
            │  /start      │ │  Server      │ │  (via server)│
            │  (token)     │ │  (audio)     │ │              │
            └──────────────┘ └──────────────┘ └──────────────┘
```

## How It Works

```
    User clicks "Call"
           │
           ▼
┌─────────────────────────┐
│ 1. Fetch token from     │
│    backend /start       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Connect to LiveKit   │
│    with token           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. Publish microphone   │
│    (user grants access) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│ 4. User speaks          │ ──────> │ Backend VoiceAgent      │
│    (mic audio sent)     │         │ processes speech        │
└─────────────────────────┘         └───────────┬─────────────┘
                                                │
            ┌───────────────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. AI response plays    │
│    through audio element│
└─────────────────────────┘
```

## Prerequisites

- Node.js 18+
- A running backend server (see [nestjs-ai-sdk-server](../nestjs-ai-sdk-server/))

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure API_ENDPOINT (see below)

# Start development server
npm run dev
```

App runs at `http://localhost:5173`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_ENDPOINT` | Yes | Backend URL for token generation |

### Example `.env`

```bash
API_ENDPOINT=http://localhost:4000/start
```

## Running with Backend

```
┌─────────────────┐                    ┌─────────────────┐
│  This App       │   POST /start      │  NestJS Server  │
│  localhost:5173 │  ───────────────>  │  localhost:4000 │
│                 │  <───────────────  │                 │
│                 │   { token, url }   │                 │
└─────────────────┘                    └─────────────────┘
```

**Steps:**

1. Start the backend first:
   ```bash
   cd ../nestjs-ai-sdk-server
   npm run start:dev
   ```

2. Configure this app's `.env`:
   ```bash
   API_ENDPOINT=http://localhost:4000/start
   ```

3. Start this app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## Features

```
┌─────────────────────────────────────────────────────────────┐
│                     Voice Chat Features                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [x] Real-time voice communication via LiveKit              │
│  [x] Live transcription display (interim + final)           │
│  [x] AI response streaming with typing indicator            │
│  [x] Audio playback with autoplay handling                  │
│  [x] Microphone toggle (mute/unmute)                        │
│  [x] Connection status indicators                           │
│  [x] Chat message history                                   │
│  [x] Error handling with retry options                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── App.tsx                  # Main application
├── lib/
│   ├── saynaClient.ts       # SDK wrapper with token handling
│   └── types.ts             # TypeScript interfaces
└── components/
    ├── connection-panel.tsx # Room config & controls
    └── chat-panel.tsx       # Message list & input
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Message Flow                                     │
│                                                                          │
│   User speaks        STT transcript       AI response        TTS audio  │
│       │                   │                   │                   │     │
│       ▼                   ▼                   ▼                   ▼     │
│   [Microphone] ──> [Data Channel] ──> [Data Channel] ──> [Audio Element]│
│       │           (user message)     (AI message)                       │
│       │                   │                   │                          │
│       │                   ▼                   ▼                          │
│       │              ┌────────────────────────────┐                     │
│       │              │      Chat Panel            │                     │
│       │              │                            │                     │
│       │              │  User: "Hello"             │                     │
│       │              │  AI: "Hi! How can I help?" │                     │
│       │              └────────────────────────────┘                     │
│       │                                                                  │
│       └──────────────────────────────────────────────────────────────>  │
│                        LiveKit audio stream                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Related

- [NestJS AI Server](../nestjs-ai-sdk-server/) - Backend for this UI
- [Sayna JS SDK](https://github.com/saynaai/saysdk/tree/main/js-sdk) - Client SDK used here
- [Sayna](https://github.com/saynaai/sayna) - Voice processing platform
