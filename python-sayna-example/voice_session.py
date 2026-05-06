"""Sayna voice session lifecycle.

Wraps a single SaynaClient connection: builds the STT/TTS/LiveKit
config, registers callbacks, joins the room, sends the greeting, then
forwards each final STT transcript to the VoiceAgent and pipes streamed
sentences back to TTS. The session blocks on an asyncio Event so the
caller's background task stays alive for the duration of the call.
"""

import asyncio
import logging

from sayna_client import (
    ErrorMessage,
    LiveKitConfig,
    ParticipantDisconnectedMessage,
    ReadyMessage,
    SaynaClient,
    STTConfig,
    STTResultMessage,
    TTSConfig,
)

from config import settings
from voice_agent import VoiceAgent

logger = logging.getLogger(__name__)

_GREETING = "Hello! I am your AI assistant. How can I help you today?"


class VoiceSession:
    def __init__(self, room_name: str, agent: VoiceAgent) -> None:
        self.room_name = room_name
        self._agent = agent
        self._client = self._build_client()
        self._running = False
        self._ready = asyncio.Event()
        self._stopped = asyncio.Event()

    async def run(self) -> None:
        self._register_callbacks()
        await self._client.connect()
        # connect() returns once the WebSocket is open, but STT/TTS providers
        # only finish initializing when the server emits the `ready` event.
        await self._ready.wait()
        self._running = True
        logger.info("voice session ready (room=%s)", self.room_name)
        await self._client.speak(_GREETING)
        await self._stopped.wait()

    async def stop(self) -> None:
        if not self._running and self._stopped.is_set():
            return
        self._running = False
        self._agent.clear_history(self.room_name)
        try:
            await self._client.disconnect()
        except Exception:
            logger.exception("error disconnecting sayna client")
        finally:
            # SaynaClient has no public close for its REST aiohttp session;
            # closing it here prevents 'Unclosed client session' warnings.
            try:
                await self._client._http_client.close()
            except Exception:
                pass
            self._stopped.set()
            logger.info("voice session stopped (room=%s)", self.room_name)

    def _build_client(self) -> SaynaClient:
        stt_config = STTConfig(
            provider="deepgram",
            language="en-US",
            sample_rate=16000,
            channels=1,
            punctuation=True,
            encoding="linear16",
            model="nova-3",
        )
        tts_config = TTSConfig(
            provider="elevenlabs",
            model="eleven_turbo_v2_5",
            voice_id=settings.elevenlabs_voice_id,
            speaking_rate=1.0,
            audio_format="linear16",
            sample_rate=16000,
        )
        livekit_config = LiveKitConfig(
            room_name=self.room_name,
            sayna_participant_identity="ai-agent",
            sayna_participant_name="AI Assistant",
        )
        return SaynaClient(
            url=settings.sayna_url,
            stt_config=stt_config,
            tts_config=tts_config,
            livekit_config=livekit_config,
            api_key=settings.sayna_api_key,
        )

    def _register_callbacks(self) -> None:
        self._client.register_on_ready(self._on_ready)
        self._client.register_on_stt_result(self._on_stt_result)
        self._client.register_on_participant_disconnected(self._on_participant_disconnected)
        self._client.register_on_error(self._on_error)

    def _on_ready(self, _msg: ReadyMessage) -> None:
        self._ready.set()

    async def _on_stt_result(self, result: STTResultMessage) -> None:
        transcript = result.transcript.strip()
        if not transcript or not (result.is_final and result.is_speech_final):
            return
        logger.info("transcript (room=%s): %s", self.room_name, transcript)
        await self._agent.stream(transcript, self.room_name, self._speak_sentence)

    async def _speak_sentence(self, sentence: str) -> None:
        if not self._running:
            return
        await self._client.speak(sentence)

    async def _on_participant_disconnected(self, _msg: ParticipantDisconnectedMessage) -> None:
        logger.info("participant disconnected (room=%s)", self.room_name)
        await self.stop()

    def _on_error(self, err: ErrorMessage) -> None:
        logger.error("sayna error (room=%s): %s", self.room_name, err.message)
