"""FastAPI entry point.

Two routes:
- GET /              - liveness check
- POST /sayna/webhook - receives signed SIP webhooks from Sayna and spawns
                        a background voice session for the call.
"""

import logging

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from sayna_client import SaynaValidationError, WebhookReceiver

from config import settings
from voice_agent import VoiceAgent
from voice_session import VoiceSession

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sayna Python Example")
agent = VoiceAgent(google_api_key=settings.google_api_key)
webhook_receiver = WebhookReceiver(secret=settings.sayna_webhook_secret)


@app.get("/")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/sayna/webhook")
async def sayna_webhook(request: Request, background_tasks: BackgroundTasks) -> dict[str, str]:
    body = (await request.body()).decode("utf-8")
    try:
        event = webhook_receiver.receive(headers=dict(request.headers), body=body)
    except SaynaValidationError as exc:
        logger.warning("rejected webhook: %s", exc)
        raise HTTPException(status_code=401, detail=str(exc))

    logger.info(
        "SIP call %s -> %s (room=%s)",
        event.from_phone_number,
        event.to_phone_number,
        event.room.name,
    )

    session = VoiceSession(room_name=event.room.name, agent=agent)
    background_tasks.add_task(_run_session, session)
    return {"status": "accepted"}


async def _run_session(session: VoiceSession) -> None:
    try:
        await session.run()
    except Exception:
        logger.exception("voice session crashed (room=%s)", session.room_name)
    finally:
        await session.stop()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=False)
