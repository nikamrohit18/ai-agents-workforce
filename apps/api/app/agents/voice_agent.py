"""LangGraph agent for the Voice Receptionist.

Same StateGraph + custom-stream-writer shape as support_agent.py / echo_agent.py,
extended with one tool call (book_appointment) so the model can write a real row
to Postgres mid-conversation instead of just talking about it. The caller-facing
transport (Vapi) speaks OpenAI chat-completions over HTTP, not raw audio, so this
graph only ever sees text turns - see app/api/voice.py for the wire format.
"""

import json
from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import TypedDict
from zoneinfo import ZoneInfo

import litellm
from langgraph.config import get_stream_writer
from langgraph.graph import END, StateGraph

from app.core.config import get_settings
from app.core.db import get_pool

litellm.drop_params = True


class ChatMessage(TypedDict):
    role: str
    content: str


class ToolCall(TypedDict):
    id: str | None
    args: dict


class VoiceState(TypedDict):
    messages: list[ChatMessage]
    caller_phone: str
    tool_call: ToolCall | None
    booked_appointment_id: str | None


BOOK_APPOINTMENT_TOOL = {
    "type": "function",
    "function": {
        "name": "book_appointment",
        "description": "Book an appointment once you have the caller's name and a specific date/time they've confirmed.",
        "parameters": {
            "type": "object",
            "properties": {
                "caller_name": {"type": "string", "description": "The caller's name"},
                "requested_at": {
                    "type": "string",
                    "description": "Exact ISO 8601 datetime, e.g. 2026-08-25T14:00:00 - resolve any relative phrase ('tomorrow', 'next Monday') before calling this",
                },
                "notes": {"type": "string", "description": "Reason for the visit or any other detail the caller mentioned"},
            },
            "required": ["caller_name", "requested_at"],
        },
    },
}

NO_KEY_FALLBACK = (
    "OPENAI_API_KEY isn't configured yet, so I'm streaming this canned reply "
    "instead of a real model response. Set OPENAI_API_KEY in apps/api/.env and "
    "restart the server to talk to a real model."
)


def _system_prompt(business_tz: ZoneInfo) -> str:
    today = datetime.now(business_tz).strftime("%A, %B %d, %Y")
    return (
        "You are a phone receptionist for a small business. Keep replies short and "
        "conversational - you're being read aloud on a phone call, not displayed as text. "
        f"Today is {today}, in the business's own local timezone ({business_tz.key}) - "
        "always reason about dates and times in that timezone, not any other. Collect "
        "the caller's name and a specific date/time before calling book_appointment; "
        "resolve relative phrases like 'tomorrow' or 'next Monday' into an exact ISO "
        "8601 datetime yourself, with no UTC offset (e.g. 2026-08-25T14:00:00 for 2pm "
        "business-local time). Never call book_appointment until the caller has "
        "confirmed both their name and the time."
    )


async def _generate(state: VoiceState) -> VoiceState:
    settings = get_settings()
    writer = get_stream_writer()

    if not settings.openai_api_key:
        for word in NO_KEY_FALLBACK.split(" "):
            writer({"token": word + " "})
        return {
            **state,
            "messages": [*state["messages"], {"role": "assistant", "content": NO_KEY_FALLBACK}],
            "tool_call": None,
        }

    business_tz = ZoneInfo(settings.voice_business_timezone)
    llm_messages = [{"role": "system", "content": _system_prompt(business_tz)}, *state["messages"]]
    full_reply = ""
    tool_call_id: str | None = None
    tool_call_name: str | None = None
    tool_call_args = ""

    response = await litellm.acompletion(
        model="gpt-4.1-mini",
        messages=llm_messages,
        tools=[BOOK_APPOINTMENT_TOOL],
        stream=True,
        api_key=settings.openai_api_key,
    )
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta.content:
            full_reply += delta.content
            writer({"token": delta.content})
        for tc in delta.tool_calls or []:
            if tc.id:
                tool_call_id = tc.id
            if tc.function and tc.function.name:
                tool_call_name = tc.function.name
            if tc.function and tc.function.arguments:
                tool_call_args += tc.function.arguments

    tool_call: ToolCall | None = None
    if tool_call_name == "book_appointment":
        try:
            args = json.loads(tool_call_args or "{}")
        except json.JSONDecodeError:
            args = {}
        tool_call = {"id": tool_call_id, "args": args}

    return {
        **state,
        "messages": [*state["messages"], {"role": "assistant", "content": full_reply}],
        "tool_call": tool_call,
    }


async def _book_appointment(state: VoiceState) -> VoiceState:
    writer = get_stream_writer()
    settings = get_settings()
    tool_call = state["tool_call"]
    args = tool_call["args"] if tool_call else {}

    caller_name = (args.get("caller_name") or "").strip() or "Unknown caller"
    notes = args.get("notes")

    try:
        requested_at = datetime.fromisoformat(args["requested_at"])
    except (KeyError, TypeError, ValueError):
        confirmation = "Sorry, I didn't catch a valid date and time for that - could you say it again?"
        writer({"token": confirmation})
        return {**state, "messages": [*state["messages"], {"role": "assistant", "content": confirmation}]}

    if requested_at.tzinfo is None:
        # The model is instructed to give a plain (no-offset) datetime in the
        # business's own timezone - localize it explicitly rather than trusting
        # whatever timezone the server process happens to be running in.
        requested_at = requested_at.replace(tzinfo=ZoneInfo(settings.voice_business_timezone))

    pool = await get_pool()
    async with pool.acquire() as conn:
        overlap = await conn.fetchrow(
            """
            SELECT id FROM appointments
            WHERE user_id = $1 AND status != 'cancelled'
              AND requested_at < $2
              AND requested_at + (duration_minutes || ' minutes')::interval > $3
            LIMIT 1
            """,
            settings.voice_agent_user_id,
            requested_at + timedelta(minutes=30),
            requested_at,
        )
        if overlap:
            confirmation = "That time is already booked - do you have another time that works?"
            writer({"token": confirmation})
            return {**state, "messages": [*state["messages"], {"role": "assistant", "content": confirmation}]}

        row = await conn.fetchrow(
            """
            INSERT INTO appointments (user_id, caller_name, caller_phone, requested_at, notes, status)
            VALUES ($1, $2, $3, $4, $5, 'confirmed')
            RETURNING id
            """,
            settings.voice_agent_user_id,
            caller_name,
            state.get("caller_phone") or "unknown",
            requested_at,
            notes,
        )

    confirmation = (
        f"You're all set, {caller_name} - I've booked you for "
        f"{requested_at.strftime('%A, %B %d at %I:%M %p')}. Anything else?"
    )
    writer({"token": confirmation})
    return {
        **state,
        "messages": [*state["messages"], {"role": "assistant", "content": confirmation}],
        "booked_appointment_id": str(row["id"]),
    }


def _route_after_generate(state: VoiceState) -> str:
    return "book_appointment" if state.get("tool_call") else END


def build_graph():
    graph = StateGraph(VoiceState)
    graph.add_node("generate", _generate)
    graph.add_node("book_appointment", _book_appointment)
    graph.set_entry_point("generate")
    graph.add_conditional_edges(
        "generate",
        _route_after_generate,
        {"book_appointment": "book_appointment", END: END},
    )
    graph.add_edge("book_appointment", END)
    return graph.compile()


_compiled_graph = build_graph()


async def stream_voice_reply(caller_phone: str, messages: list[ChatMessage]) -> AsyncIterator[str]:
    async for _, payload in _compiled_graph.astream(
        {"messages": messages, "caller_phone": caller_phone, "tool_call": None, "booked_appointment_id": None},
        stream_mode=["custom"],
    ):
        token = payload.get("token")
        if token:
            yield token
