# Sayna Python Example — SIP Webhook + Gemini Voice Agent

A minimal FastAPI service demonstrating the **SIP webhook** flow: a phone call arrives at Sayna, Sayna forwards a signed webhook here, and a background voice agent (Deepgram STT → Gemini stream → ElevenLabs TTS) holds a conversation with the caller until they hang up.

## Architecture

```
┌──────────┐       ┌──────────┐  signed webhook   ┌──────────────────┐
│  Caller  │──SIP─>│  Sayna   │──────────────────>│  POST /sayna/    │
└──────────┘       │  Server  │                   │     webhook      │
                   │          │                   │                  │
                   │          │<──WebSocket──┐    │   (background)   │
                   └────┬─────┘    audio     │    └────────┬─────────┘
                        │                    │             │
                        ▼                    │             ▼
                   ┌──────────┐              │       ┌──────────────┐
                   │ LiveKit  │              └───────│  SaynaClient │
                   │   room   │                      │  + Gemini    │
                   └──────────┘                      └──────────────┘
```

**Flow:**

1. SIP call hits the Sayna server, which routes it into a LiveKit room.
2. Sayna posts a signed webhook to `POST /sayna/webhook`.
3. The route verifies the HMAC signature with `WebhookReceiver` and dispatches a background task.
4. The background `VoiceSession` opens a WebSocket to Sayna, joins the same LiveKit room as `ai-agent`, and speaks the greeting.
5. Each final STT transcript is fed to the `VoiceAgent`, which streams a Gemini response.
6. The agent yields one sentence at a time; each sentence is sent to TTS immediately for low-latency speech.
7. When the caller hangs up, `participant_disconnected` fires, the session disconnects, and history is cleared.

## Prerequisites

- Python 3.10+
- A [Google AI API key](https://aistudio.google.com/apikey) for Gemini
- Docker (for the local Sayna + LiveKit + LiveKit SIP stack)

## Run the Sayna stack

The bundled [`../docker-compose.yml`](../docker-compose.yml) brings up Sayna (port 3002), LiveKit (7880), LiveKit SIP (5063), and Redis. From the `examples/` directory:

```bash
export DEEPGRAM_API_KEY=...
export ELEVENLABS_API_KEY=...
docker compose up
```

The `sayna` service is configured with [`../sayna.example.yaml`](../sayna.example.yaml), which forwards SIP webhooks to `http://localhost:5002/sayna/webhook` — the route exposed by this example.

## Run the example

```bash
cd python-sayna-example
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env and set GOOGLE_API_KEY

python main.py
```

The server listens on `http://0.0.0.0:5002` by default. Place a SIP call to the running LiveKit SIP gateway and the agent will answer.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_API_KEY` | yes | — | Google AI API key for Gemini |
| `SAYNA_URL` | no | `http://localhost:3001` | Sayna API base URL |
| `SAYNA_API_KEY` | no | `secret-key-1234567890` | Matches `auth.api_secrets[0].secret` in `sayna.example.yaml` |
| `SAYNA_WEBHOOK_SECRET` | no | `hook-secret-1234567890` | Matches `sip.hook_secret` in `sayna.example.yaml` |
| `ELEVENLABS_VOICE_ID` | no | `ZIlrSGI4jZqobxRKprJz` | ElevenLabs voice the agent speaks with |
| `PORT` | no | `5002` | FastAPI bind port — must match `sayna.example.yaml` `hooks[].url` |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Liveness check |
| `POST` | `/sayna/webhook` | Receives signed SIP webhooks from Sayna |

## Project Structure

```
python-sayna-example/
├── main.py            # FastAPI app + the two routes
├── config.py          # Settings (defaults from sayna.example.yaml)
├── prompts.py         # Voice assistant system prompt + fallbacks
├── voice_agent.py     # Gemini streaming + sentence extraction (no Sayna imports)
├── voice_session.py   # SaynaClient lifecycle + STT → agent → TTS glue
├── requirements.txt
├── .env.example
└── .gitignore
```

`voice_agent.py` and `voice_session.py` are intentionally decoupled — the agent module has no
Sayna dependency, so it can be exercised against any text-in/text-out harness.

## Related

- [`../nestjs-ai-sdk-server/`](../nestjs-ai-sdk-server/) — Node.js sibling demonstrating the browser/`POST /start` flow
- [`../sayna.example.yaml`](../sayna.example.yaml) — Sayna server config used by this example
- [`sayna-client` on PyPI](https://pypi.org/project/sayna-client/) — the Python SDK
- [Sayna docs](https://docs.sayna.ai)
