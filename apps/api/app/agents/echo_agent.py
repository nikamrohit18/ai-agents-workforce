"""Minimal one-node LangGraph agent.

This is the walking-skeleton agent: it proves the plumbing (frontend -> API
layer -> LangGraph -> LLM provider -> streamed tokens -> frontend) works
end to end. Every later agent (RAG, SDR, voice, etc.) is a bigger graph
built on the same StateGraph + custom-stream pattern.
"""

from collections.abc import AsyncIterator
from typing import TypedDict

import litellm
from langgraph.config import get_stream_writer
from langgraph.graph import END, StateGraph

from app.core.config import get_settings

litellm.drop_params = True


class ChatMessage(TypedDict):
    role: str
    content: str


class AgentState(TypedDict):
    messages: list[ChatMessage]


SYSTEM_PROMPT = (
    "You are the demo agent for an AI agents portfolio platform. "
    "Answer briefly and mention you're running on LangGraph when relevant."
)

NO_KEY_FALLBACK = (
    "No LLM provider key is configured yet, so I'm streaming this canned "
    "reply instead of a real model response. Set ANTHROPIC_API_KEY or "
    "OPENAI_API_KEY in apps/api/.env and restart the server to talk to a "
    "real model through this same LangGraph node."
)


async def _respond(state: AgentState) -> AgentState:
    settings = get_settings()
    writer = get_stream_writer()

    if not settings.has_llm_key:
        for word in NO_KEY_FALLBACK.split(" "):
            writer({"token": word + " "})
        return {"messages": [*state["messages"], {"role": "assistant", "content": NO_KEY_FALLBACK}]}

    llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}, *state["messages"]]
    full_reply = ""

    response = await litellm.acompletion(
        model=settings.llm_model,
        messages=llm_messages,
        stream=True,
        api_key=settings.anthropic_api_key or settings.openai_api_key,
    )
    async for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            full_reply += delta
            writer({"token": delta})

    return {"messages": [*state["messages"], {"role": "assistant", "content": full_reply}]}


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("respond", _respond)
    graph.set_entry_point("respond")
    graph.add_edge("respond", END)
    return graph.compile()


_compiled_graph = build_graph()


async def stream_agent_reply(messages: list[ChatMessage]) -> AsyncIterator[str]:
    async for _, payload in _compiled_graph.astream(
        {"messages": messages},
        stream_mode=["custom"],
    ):
        token = payload.get("token")
        if token:
            yield token
