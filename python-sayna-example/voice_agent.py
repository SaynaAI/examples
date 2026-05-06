"""LangChain Gemini streaming agent.

Streams a response from `gemini-2.5-flash` for a transcript, splits the
output into sentences on `.`, `!`, `?` boundaries, and yields each
complete sentence to a callback so the caller can pipe them into TTS as
they arrive. Maintains a small per-room conversation history.

This module has no Sayna dependencies on purpose - it can be exercised
in isolation against any text in/out harness.
"""

import logging
import re
from typing import Awaitable, Callable

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from prompts import VOICE_ASSISTANT_PROMPT, random_fallback_response

logger = logging.getLogger(__name__)

OnSentence = Callable[[str], Awaitable[None]]

_SENTENCE_END = re.compile(r"[.!?](?:\s+|$)")
_MAX_HISTORY_MESSAGES = 20


class VoiceAgent:
    def __init__(self, google_api_key: str) -> None:
        self._llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.7,
            google_api_key=google_api_key,
        )
        self._history: dict[str, list[BaseMessage]] = {}

    async def stream(self, transcript: str, room_name: str, on_sentence: OnSentence) -> str:
        """Stream a Gemini response, calling ``on_sentence`` per sentence.

        Returns the full accumulated response text.
        """
        transcript = transcript.strip()
        if not transcript:
            fallback = random_fallback_response()
            await on_sentence(fallback)
            return fallback

        messages: list[BaseMessage] = [SystemMessage(content=VOICE_ASSISTANT_PROMPT)]
        messages.extend(self._history.get(room_name, []))
        messages.append(HumanMessage(content=transcript))

        full_response = ""
        sentence_buffer = ""

        try:
            async for chunk in self._llm.astream(messages):
                text = chunk.content if isinstance(chunk.content, str) else ""
                if not text:
                    continue
                full_response += text
                sentence_buffer += text
                sentences, sentence_buffer = _extract_sentences(sentence_buffer)
                for sentence in sentences:
                    await on_sentence(sentence)
        except Exception:
            logger.exception("Gemini stream failed for room %s", room_name)
            fallback = random_fallback_response()
            await on_sentence(fallback)
            return fallback

        remaining = sentence_buffer.strip()
        if remaining:
            await on_sentence(remaining)
            full_response = full_response.rstrip()

        self._append_history(room_name, HumanMessage(content=transcript))
        self._append_history(room_name, AIMessage(content=full_response))
        return full_response

    def clear_history(self, room_name: str) -> None:
        self._history.pop(room_name, None)

    def _append_history(self, room_name: str, message: BaseMessage) -> None:
        history = self._history.setdefault(room_name, [])
        history.append(message)
        if len(history) > _MAX_HISTORY_MESSAGES:
            self._history[room_name] = history[-_MAX_HISTORY_MESSAGES // 2 :]


def _extract_sentences(buffer: str) -> tuple[list[str], str]:
    sentences: list[str] = []
    last_index = 0
    for match in _SENTENCE_END.finditer(buffer):
        end_pos = match.end()
        sentence = buffer[last_index:end_pos].strip()
        if sentence:
            sentences.append(sentence)
        last_index = end_pos
    return sentences, buffer[last_index:]
