# Sayna Examples Directory

This directory contains example implementations demonstrating how to use the Sayna SDKs for building real-time voice-enabled applications. All examples should be built using the official Sayna SDKs located in `../saysdk`.

## Project Context

Sayna provides real-time voice processing services including Speech-to-Text (STT), Text-to-Speech (TTS), and LiveKit integration for multi-participant voice rooms. The platform enables developers to build voice-enabled AI agents, phone systems, transcription services, and interactive voice applications.

## Available SDKs

The Sayna SDK monorepo (`../saysdk`) contains three official client libraries:

### JavaScript SDK (Browser)
- **Location**: `../saysdk/js-sdk/`
- **Package**: `@sayna-ai/js-sdk`
- **Platform**: Browser-only (ES module)
- **Documentation**: `../saysdk/js-sdk/README.md`
- **Purpose**: Client-side voice room connections with automatic token handling and audio playback

### Node.js SDK (Server)
- **Location**: `../saysdk/node-sdk/`
- **Package**: `@sayna-ai/node-sdk`
- **Platform**: Node.js 18+
- **Documentation**: `../saysdk/node-sdk/README.md`
- **Purpose**: Server-side real-time voice processing via WebSocket and REST APIs

### Python SDK (Server)
- **Location**: `../saysdk/python-sdk/`
- **Package**: `sayna-client`
- **Platform**: Python 3.9+
- **Documentation**: `../saysdk/python-sdk/README.md`
- **Purpose**: Async Python client for voice API with full Pydantic type safety

## Development Guidelines

Detailed development rules for each SDK are defined in the `.cursor/rules/` directory:

| Rule File | Purpose |
|-----------|---------|
| `.cursor/rules/node-sdk.mdc` | Node.js SDK patterns, API methods, error handling |
| `.cursor/rules/js-sdk.mdc` | Browser SDK lifecycle, token configuration, audio handling |
| `.cursor/rules/python-sdk.mdc` | Python async patterns, Pydantic models, callback registration |
| `.cursor/rules/api-reference.mdc` | REST/WebSocket API reference, authentication, room ownership |

## SDK Selection Guide

Choose the appropriate SDK based on your implementation requirements:

### Use the JavaScript SDK (`@sayna-ai/js-sdk`) when:
- Building browser-based voice interfaces
- Implementing real-time voice chat in web applications
- Integrating voice capabilities into React, Vue, or other frontend frameworks
- Users need to speak directly through their browser

### Use the Node.js SDK (`@sayna-ai/node-sdk`) when:
- Building backend services that process voice
- Implementing webhook handlers for SIP events
- Creating API endpoints that generate LiveKit tokens
- Processing audio server-side before streaming
- Integrating with telephony systems

### Use the Python SDK (`sayna-client`) when:
- Building Python-based backend services
- Integrating with Python AI/ML pipelines
- Creating async voice processing applications
- Implementing webhook receivers in FastAPI or Flask

## Architecture Patterns

### Browser + Backend Pattern
For web applications, combine the JavaScript SDK (frontend) with Node.js or Python SDK (backend):

1. Backend generates LiveKit tokens using `getLiveKitToken()` / `get_livekit_token()`
2. Frontend receives token via API endpoint
3. Frontend connects to voice room using JavaScript SDK
4. Backend handles webhooks and server-side processing

### Server-Only Pattern
For telephony or headless applications, use Node.js or Python SDK:

1. Server connects via WebSocket to Sayna API
2. Server sends/receives audio for STT/TTS
3. Server handles all voice processing logic
4. LiveKit used for multi-participant scenarios

### Full-Stack Real-Time Pattern
For complex applications requiring both client and server voice handling:

1. Backend maintains WebSocket connection to Sayna
2. Backend joins LiveKit rooms as participant
3. Frontend users connect via JavaScript SDK
4. Backend processes and responds to user speech

## API Reference Resources

### Server Documentation
- **OpenAPI Specification**: `../sayna/docs/openapi.yaml` - Complete REST API schema
- **WebSocket Protocol**: `../sayna/docs/websocket.md` - Message formats and flow
- **API Reference**: `../sayna/docs/api-reference.md` - Human-readable guide
- **Authentication**: `../sayna/docs/authentication.md` - JWT and auth strategies
- **LiveKit Integration**: `../sayna/docs/livekit_integration.md` - Room management
- **SIP Routing**: `../sayna/docs/sip_routing.md` - Webhook configuration

### Provider Documentation
Located in `../sayna/docs/`:
- STT Providers: `deepgram-stt.md`, `google-stt.md`
- TTS Providers: `elevenlabs-tts.md`, `google-tts.md`, `deepgram-tts.md`, `cartesia-tts.md`

### Public Documentation
- **Website**: https://docs.sayna.ai
- **Quickstart Guide**: `../docs/quickstart.mdx`
- **Architecture Overview**: `../docs/guides/architecture.mdx`
- **Operations Guide**: `../docs/guides/operations.mdx`

## SDK Features Comparison

| Feature | JS SDK | Node.js SDK | Python SDK |
|---------|--------|-------------|------------|
| REST API calls | Via backend | Full support | Full support |
| WebSocket streaming | N/A | Full support | Full support |
| LiveKit client | Built-in | Server-side | Server-side |
| Token generation | Via backend | `getLiveKitToken()` | `get_livekit_token()` |
| STT processing | Via backend | `onAudioInput()` | `on_audio_input()` |
| TTS synthesis | Via backend | `speak()` | `speak()` |
| Webhook receiver | N/A | `WebhookReceiver` | `WebhookReceiver` |
| SIP calling | Via backend | `sipCall()` | `sip_call()` |
| Room management | Via LiveKit | Full REST API | Full REST API |
| Type safety | TypeScript | TypeScript | Pydantic |

## Core Concepts

### Dual API Architecture
The Sayna API provides two communication modes:

1. **REST API** - Stateless HTTP endpoints for:
   - Health checks and voice catalog
   - One-shot TTS synthesis
   - LiveKit token generation
   - Room and participant management
   - SIP webhook configuration
   - Recording downloads

2. **WebSocket API** - Stateful streaming for:
   - Real-time STT transcription
   - Streaming TTS audio
   - Bidirectional messaging
   - Session management

### Connection Flow
The standard connection pattern for WebSocket-based SDKs:

1. Create client with configuration (URL, STT config, TTS config)
2. Register event callbacks for responses
3. Call `connect()` to establish WebSocket
4. Wait for `ready` state before sending commands
5. Use API methods for voice interaction
6. Call `disconnect()` for cleanup

### Room Ownership Model
Sayna enforces tenant isolation through room metadata:

- Room names are passed unchanged (no SDK-level prefixing)
- Server manages `metadata.auth_id` for ownership
- Room listings are scoped to authenticated context
- 403 errors indicate cross-tenant access attempts
- 404 errors may mask access denial for security

### Webhook Security
For SIP event webhooks:

- HMAC-SHA256 signature verification required
- Timestamp-based replay protection (5-minute window)
- Raw request body must be used for signature validation
- Minimum 16-character secret required

## Best Practices for Example Implementations

### Configuration Management
- Use environment variables for API keys and secrets
- Never commit credentials to version control
- Separate configuration from business logic
- Document required environment variables

### Error Handling
- Catch and handle SDK-specific error types
- Provide meaningful error messages to users
- Implement retry logic for transient failures
- Log errors appropriately for debugging

### Resource Cleanup
- Always disconnect WebSocket connections when finished
- Clean up audio resources and event listeners
- Handle component unmount in frontend frameworks
- Implement graceful shutdown in backend services

### Audio Handling
- Match sample rates between configuration and audio source
- Use appropriate encoding for the target platform
- Implement proper buffering for streaming
- Handle audio interruptions gracefully

### Testing
- Test with local development server when possible
- Verify webhook signatures in test environment
- Test error scenarios and edge cases
- Validate type safety with TypeScript/mypy

## Example Categories

When building examples, consider organizing by use case:

### Basic Integration
- Health check and voice catalog exploration
- Simple TTS synthesis
- Basic STT transcription
- Token generation for LiveKit

### Voice Chat Applications
- Browser-based voice rooms
- Multi-participant conversations
- Real-time transcription display
- Voice command interfaces

### Telephony Integration
- Inbound SIP call handling
- Outbound call initiation
- Call transfer workflows
- Webhook processing

### AI Agent Integration
- Voice-enabled chatbots
- Conversational AI interfaces
- Speech-to-text pipelines
- Text-to-speech response generation

## SDK Reference Quick Links

For implementation details, always consult the SDK README files:

- **JavaScript SDK**: `../saysdk/js-sdk/README.md`
- **Node.js SDK**: `../saysdk/node-sdk/README.md`
- **Python SDK**: `../saysdk/python-sdk/README.md`
- **SDK CLAUDE.md**: `../saysdk/CLAUDE.md`

For API specifications:

- **OpenAPI Schema**: `../sayna/docs/openapi.yaml`
- **WebSocket Protocol**: `../sayna/docs/websocket.md`
- **Public Docs**: https://docs.sayna.ai

## Version Policy

Always use the latest SDK versions when building examples. Do not pin to specific versions unless there is a compatibility requirement.
