# Sayna Examples

Example implementations for building real-time voice AI applications with [Sayna](https://github.com/saynaai/sayna).

## What is Sayna?

Sayna is a real-time voice processing platform that provides:

- **Speech-to-Text (STT)** - Real-time transcription
- **Text-to-Speech (TTS)** - Natural voice synthesis
- **LiveKit Integration** - Multi-participant voice rooms

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE SYSTEM                                 │
│                                                                              │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │                           Your Application                             │ │
│   │                                                                        │ │
│   │   ┌─────────────────────┐        ┌─────────────────────┐             │ │
│   │   │   React Frontend    │        │   NestJS Backend    │             │ │
│   │   │   (Browser)         │        │   (Server)          │             │ │
│   │   │                     │        │                     │             │ │
│   │   │   @sayna-ai/js-sdk  │        │  @sayna-ai/node-sdk │             │ │
│   │   └──────────┬──────────┘        └──────────┬──────────┘             │ │
│   │              │                              │                         │ │
│   └──────────────┼──────────────────────────────┼─────────────────────────┘ │
│                  │                              │                           │
│   ┌──────────────┼──────────────────────────────┼─────────────────────────┐ │
│   │              │       Sayna Platform         │                         │ │
│   │              │                              │                         │ │
│   │              ▼                              ▼                         │ │
│   │   ┌─────────────────────┐        ┌─────────────────────┐             │ │
│   │   │   LiveKit Server    │        │   Sayna API         │             │ │
│   │   │   (audio/text)      │<──────>│   (STT/TTS)         │             │ │
│   │   └─────────────────────┘        └─────────────────────┘             │ │
│   │                                                                       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Examples in This Repository

| Example | Description | Tech Stack |
|---------|-------------|------------|
| [react-vite-ui](./react-vite-ui/) | Voice chat frontend | React, TypeScript, Vite, Sayna JS SDK |
| [nestjs-ai-sdk-server](./nestjs-ai-sdk-server/) | Voice AI backend | NestJS, Vercel AI SDK, Google Gemini, Sayna Node SDK |

## Quick Start

```
┌────────────────────────────────────────────────────────────────┐
│                    GET RUNNING IN 5 MINUTES                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Terminal 1 (Backend)          Terminal 2 (Frontend)          │
│   ─────────────────────         ─────────────────────          │
│                                                                 │
│   cd nestjs-ai-sdk-server       cd react-vite-ui               │
│   cp .env.example .env          cp .env.example .env           │
│   # Edit .env with your keys    # API_ENDPOINT is pre-set      │
│   npm install                   npm install                    │
│   npm run start:dev             npm run dev                    │
│                                                                 │
│   Server: localhost:4000        App: localhost:5173            │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Environment Setup

**Backend** (`nestjs-ai-sdk-server/.env`):

```bash
SAYNA_URL=https://api.sayna.ai       # Your Sayna API URL
SAYNA_API_KEY=your-key               # Optional: API key
GOOGLE_GENERATIVE_AI_API_KEY=your-key # Required: Google AI key
PORT=4000
```

**Frontend** (`react-vite-ui/.env`):

```bash
API_ENDPOINT=http://localhost:4000/start
```

## How It Works

### Voice Conversation Flow

```
     ┌─────────────────────────────────────────────────────────────────┐
     │                    VOICE CONVERSATION FLOW                       │
     └─────────────────────────────────────────────────────────────────┘

  USER                 BROWSER                SERVER               AI
   │                      │                      │                  │
   │  1. Click "Call"     │                      │                  │
   │─────────────────────>│                      │                  │
   │                      │  2. POST /start      │                  │
   │                      │─────────────────────>│                  │
   │                      │  3. Token + URL      │                  │
   │                      │<─────────────────────│                  │
   │                      │                      │                  │
   │                      │  4. Connect LiveKit  │                  │
   │                      │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                  │
   │                      │                      │                  │
   │  5. Speak "Hello"    │                      │                  │
   │─────────────────────>│  6. Audio stream     │                  │
   │                      │═════════════════════>│                  │
   │                      │                      │  7. STT: "Hello" │
   │                      │                      │─────────────────>│
   │                      │                      │  8. AI response  │
   │                      │                      │<─────────────────│
   │                      │  9. TTS audio        │                  │
   │                      │<=════════════════════│                  │
   │  10. Hear response   │                      │                  │
   │<─────────────────────│                      │                  │
   │                      │                      │                  │
```

### Component Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPONENT RESPONSIBILITIES                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  REACT FRONTEND (react-vite-ui)                                      │   │
│  │  ─────────────────────────────────                                   │   │
│  │  - Renders voice chat UI                                             │   │
│  │  - Captures microphone audio                                         │   │
│  │  - Displays transcriptions and AI responses                          │   │
│  │  - Plays AI voice responses                                          │   │
│  │  - Manages connection state                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  NESTJS BACKEND (nestjs-ai-sdk-server)                               │   │
│  │  ─────────────────────────────────────                               │   │
│  │  - Generates LiveKit tokens                                          │   │
│  │  - Runs VoiceAgent (STT listener + AI responder + TTS speaker)       │   │
│  │  - Integrates Google Gemini for AI responses                         │   │
│  │  - Manages conversation history per room                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SAYNA PLATFORM (external)                                           │   │
│  │  ───────────────────────────                                         │   │
│  │  - Provides STT (Deepgram, Google, etc.)                             │   │
│  │  - Provides TTS (ElevenLabs, Google, etc.)                           │   │
│  │  - Manages LiveKit rooms                                             │   │
│  │  - Handles real-time audio streaming                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## SDKs Used

| SDK | Package | Used In | Purpose |
|-----|---------|---------|---------|
| [JS SDK](https://github.com/saynaai/saysdk/tree/main/js-sdk) | `@sayna-ai/js-sdk` | Frontend | Browser voice rooms |
| [Node SDK](https://github.com/saynaai/saysdk/tree/main/node-sdk) | `@sayna-ai/node-sdk` | Backend | Server voice processing |

## Architecture Patterns

### Frontend + Backend Pattern (This Example)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Best for: Web apps with AI-powered voice assistants                      │
│                                                                           │
│  ┌─────────────┐     REST      ┌─────────────┐    WebSocket  ┌────────┐ │
│  │   Browser   │─────/start───>│   Server    │───────────────>│ Sayna  │ │
│  │             │               │             │                │        │ │
│  │  JS SDK     │───LiveKit────>│  Node SDK   │<──────────────>│        │ │
│  │             │   (audio)     │             │   (STT/TTS)    │        │ │
│  └─────────────┘               └──────┬──────┘                └────────┘ │
│                                       │                                   │
│                                       ▼                                   │
│                                ┌─────────────┐                           │
│                                │  AI Model   │                           │
│                                │  (Gemini)   │                           │
│                                └─────────────┘                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Documentation

| Resource | Link |
|----------|------|
| Sayna Docs | [docs.sayna.ai](https://docs.sayna.ai) |
| Sayna Repository | [github.com/saynaai/sayna](https://github.com/saynaai/sayna) |
| SDK Repository | [github.com/saynaai/saysdk](https://github.com/saynaai/saysdk) |
