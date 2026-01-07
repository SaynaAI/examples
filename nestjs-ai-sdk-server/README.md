# Sayna Voice AI Server

A NestJS backend that powers voice-enabled AI conversations using [Sayna](https://github.com/saynaai/sayna), [Vercel AI SDK](https://sdk.vercel.ai), and Google Gemini.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NestJS Server                                      │
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐   │
│  │   /start    │────>│ SaynaService│────>│        VoiceAgent           │   │
│  │  endpoint   │     │             │     │                             │   │
│  └─────────────┘     └──────┬──────┘     │  ┌───────────────────────┐  │   │
│        │                    │            │  │  STT → AI → TTS loop  │  │   │
│        │                    │            │  └───────────────────────┘  │   │
│        │                    │            └──────────────┬──────────────┘   │
│        ▼                    ▼                           │                  │
│  ┌─────────────┐     ┌─────────────┐            ┌──────▼──────┐           │
│  │ LiveKit     │     │  Sayna API  │            │  AiService  │           │
│  │ Token       │     │  (REST)     │            │  (Gemini)   │           │
│  └──────┬──────┘     └─────────────┘            └─────────────┘           │
└─────────┼────────────────────────────────────────────────────────────────────┘
          │
          ▼
    Returns token
    to React UI
```

## How It Works

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │  POST   │   NestJS     │  REST   │   Sayna      │
│   (React)    │────────>│   Server     │────────>│   API        │
│              │ /start  │              │  token  │              │
└──────┬───────┘         └──────┬───────┘         └──────────────┘
       │                        │
       │  LiveKit               │  WebSocket
       │  (audio/data)          │  (STT/TTS)
       │                        │
       ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   LiveKit    │<───────>│   Voice      │────────>│   Google     │
│   Server     │  audio  │   Agent      │   AI    │   Gemini     │
│              │         │              │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
```

**Flow:**

1. React UI calls `POST /start` with room configuration
2. Server requests LiveKit token from Sayna API
3. Server starts VoiceAgent in background
4. Server returns token to React UI immediately
5. VoiceAgent connects to Sayna WebSocket
6. User speaks → Sayna STT transcribes → AI generates response → Sayna TTS speaks

## Prerequisites

- Node.js 18+
- [Sayna API](https://github.com/saynaai/sayna) access
- [Google AI API key](https://aistudio.google.com/apikey) for Gemini

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your API keys (see Environment Variables below)

# Start development server
npm run start:dev
```

Server runs at `http://localhost:4000` by default.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SAYNA_URL` | Yes | Sayna API URL (e.g., `https://api.sayna.ai`) |
| `SAYNA_API_KEY` | No | API key if your Sayna instance requires authentication |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Google AI API key for Gemini |
| `PORT` | No | Server port (default: `4000`) |

### Example `.env`

```bash
SAYNA_URL=https://api.sayna.ai
SAYNA_API_KEY=your-sayna-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key
PORT=4000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/start` | Start a voice session, returns LiveKit token |
| `GET` | `/health` | Health check (includes Sayna API status) |

### POST /start

Starts a voice session and returns LiveKit credentials.

**Request:**

```json
{
  "room_name": "my-room",
  "participant_name": "John",
  "participant_identity": "user-123"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "livekit_url": "wss://livekit.example.com"
}
```

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── ai/
│   ├── ai.service.ts       # Google Gemini integration
│   └── prompts/            # AI system prompts
├── sayna/
│   ├── sayna.controller.ts # HTTP endpoints
│   ├── sayna.service.ts    # Sayna SDK integration
│   └── voice-agent.ts      # Real-time voice agent
├── config/
│   └── env.validation.ts   # Environment validation
└── common/
    └── filters/            # Exception handling
```

## Running with React UI

This server is designed to work with the [React Voice Chat UI](../react-vite-ui/):

```
┌─────────────────┐                    ┌─────────────────┐
│  React UI       │                    │  NestJS Server  │
│  localhost:5173 │  ──── /start ────> │  localhost:4000 │
└─────────────────┘                    └─────────────────┘
```

1. Start this server first: `npm run start:dev`
2. Configure React UI's `API_ENDPOINT=http://localhost:4000/start`
3. Start React UI: `npm run dev`

## Related

- [React Voice Chat UI](../react-vite-ui/) - Frontend for this server
- [Sayna](https://github.com/saynaai/sayna) - Voice processing platform
- [Sayna Node.js SDK](https://github.com/saynaai/saysdk/tree/main/node-sdk) - Server SDK used here
- [Vercel AI SDK](https://sdk.vercel.ai) - AI integration framework
