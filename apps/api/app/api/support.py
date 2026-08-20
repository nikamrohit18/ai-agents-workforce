import json

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agents.support_agent import ChatMessage, stream_support_reply

router = APIRouter(prefix="/agents/support", tags=["agents"])


class SupportChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: str


@router.post("/stream")
async def support_stream(payload: SupportChatRequest):
    async def event_generator():
        async for event in stream_support_reply(payload.user_id, payload.messages):
            if "token" in event:
                yield {"event": "token", "data": json.dumps({"token": event["token"]})}
            elif "citations" in event:
                yield {"event": "citations", "data": json.dumps({"citations": event["citations"]})}
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
