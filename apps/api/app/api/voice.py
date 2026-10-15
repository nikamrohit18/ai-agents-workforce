"""Voice Receptionist endpoints.

Unlike every other route in this API, the two Vapi-facing endpoints here are
called directly by the internet (Vapi's servers), not proxied through the
Next.js/Clerk boundary the rest of the kernel relies on. `_verify_vapi_secret`
is the trust boundary for those two routes - a shared secret configured on
both the Vapi assistant and VAPI_SERVER_SECRET.
"""

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from twilio.rest import Client as TwilioClient

from app.agents.voice_agent import ChatMessage, stream_voice_reply
from app.core.config import get_settings
from app.core.db import get_pool

router = APIRouter(prefix="/agents/voice", tags=["agents"])

MISSED_CALL_ENDED_REASONS = {
    "customer-did-not-answer",
    "customer-busy",
    "voicemail",
    "no-answer",
}

MISSED_CALL_SMS = (
    "Sorry we missed your call! Reply here or call back and we'll get you booked in."
)


def _verify_vapi_secret(x_vapi_secret: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.vapi_server_secret or x_vapi_secret != settings.vapi_server_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing Vapi secret")


class VoiceChatRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    messages: list[ChatMessage]
    call: dict | None = None


def _extract_caller_phone(call: dict | None) -> str:
    if not call:
        return "unknown"
    customer = call.get("customer") or {}
    return customer.get("number") or "unknown"


@router.post("/chat/completions", dependencies=[Depends(_verify_vapi_secret)])
async def voice_chat_completions(payload: VoiceChatRequest):
    caller_phone = _extract_caller_phone(payload.call)
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    async def event_generator():
        async for token in stream_voice_reply(caller_phone, payload.messages):
            chunk = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": "voice-receptionist",
                "choices": [{"index": 0, "delta": {"content": token}, "finish_reason": None}],
            }
            yield f"data: {json.dumps(chunk)}\n\n"

        final_chunk = {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": "voice-receptionist",
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
        yield f"data: {json.dumps(final_chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


async def _send_missed_call_sms(to_number: str) -> None:
    settings = get_settings()
    if not settings.has_voice_config or to_number == "unknown":
        return
    client = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
    await asyncio.to_thread(
        client.messages.create,
        body=MISSED_CALL_SMS,
        from_=settings.twilio_sms_from_number,
        to=to_number,
    )


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.post("/webhook", dependencies=[Depends(_verify_vapi_secret)])
async def voice_webhook(payload: dict):
    message = payload.get("message", {})
    if message.get("type") != "end-of-call-report":
        return {"ok": True}

    settings = get_settings()
    call = message.get("call", {}) or {}
    caller_phone = _extract_caller_phone(call)
    ended_reason = message.get("endedReason", "")
    status = "missed" if ended_reason in MISSED_CALL_ENDED_REASONS else "answered"
    started_at = _parse_timestamp(message.get("startedAt"))
    ended_at = _parse_timestamp(message.get("endedAt")) or datetime.now(timezone.utc)

    pool = await get_pool()
    async with pool.acquire() as conn:
        # book_appointment (voice_agent.py) writes the appointments row mid-call,
        # before this call row exists, so there's no id to carry forward directly.
        # Link them after the fact: the appointment booked by this caller during
        # this call's own time window, not yet claimed by another call.
        await conn.execute(
            """
            INSERT INTO calls (user_id, caller_phone, started_at, ended_at, status, transcript, booked_appointment_id)
            VALUES (
                $1, $2, $3, $4, $5, $6,
                (
                    SELECT a.id FROM appointments a
                    WHERE a.user_id = $1
                      AND a.caller_phone = $2
                      AND a.created_at BETWEEN COALESCE($3::timestamptz, $4::timestamptz - INTERVAL '1 hour') AND $4::timestamptz
                      AND NOT EXISTS (
                          SELECT 1 FROM calls c WHERE c.booked_appointment_id = a.id
                      )
                    ORDER BY a.created_at DESC
                    LIMIT 1
                )
            )
            """,
            settings.voice_agent_user_id,
            caller_phone,
            started_at,
            ended_at,
            status,
            message.get("transcript"),
        )

    if status == "missed":
        await _send_missed_call_sms(caller_phone)

    return {"ok": True}


@router.get("/appointments")
async def list_appointments(user_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, caller_name, caller_phone, requested_at, duration_minutes, notes, status
            FROM appointments
            WHERE user_id = $1 AND requested_at >= now()
            ORDER BY requested_at ASC
            LIMIT 50
            """,
            user_id,
        )
    return [
        {
            "id": str(row["id"]),
            "caller_name": row["caller_name"],
            "caller_phone": row["caller_phone"],
            "requested_at": row["requested_at"].isoformat(),
            "duration_minutes": row["duration_minutes"],
            "notes": row["notes"],
            "status": row["status"],
        }
        for row in rows
    ]


@router.get("/calls")
async def list_calls(user_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, caller_phone, started_at, ended_at, status, transcript, booked_appointment_id, created_at
            FROM calls
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
            """,
            user_id,
        )
    return [
        {
            "id": str(row["id"]),
            "caller_phone": row["caller_phone"],
            "started_at": row["started_at"].isoformat() if row["started_at"] else None,
            "ended_at": row["ended_at"].isoformat() if row["ended_at"] else None,
            "status": row["status"],
            "transcript": row["transcript"],
            "booked_appointment_id": str(row["booked_appointment_id"]) if row["booked_appointment_id"] else None,
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]
