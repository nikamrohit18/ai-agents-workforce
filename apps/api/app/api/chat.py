import json

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agents.echo_agent import ChatMessage, stream_agent_reply

router = APIRouter(prefix="/agents", tags=["agents"])


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: str | None = None


@router.post("/echo/stream")
async def echo_stream(payload: ChatRequest):
    async def event_generator():
        async for token in stream_agent_reply(payload.messages):
            yield {"event": "token", "data": json.dumps({"token": token})}
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
