"""Customer Support RAG agent.

retrieve -> generate. Answers are grounded in the caller's own uploaded
documents (pgvector similarity search), not the model's training data,
and every response reports which chunks it was allowed to draw from.
"""

import re
from collections.abc import AsyncIterator
from typing import TypedDict

import litellm
from langgraph.config import get_stream_writer
from langgraph.graph import END, StateGraph

from app.core.config import get_settings
from app.services.retrieval import retrieve_chunks

litellm.drop_params = True

TOP_K = 5
CITATION_PATTERN = re.compile(r"\[(\d+)\]")

SYSTEM_PROMPT = """You are a customer support agent. Answer ONLY using the numbered \
sources below - if they don't contain the answer, say you don't know and suggest \
the user rephrase or upload a more relevant document. Never use outside knowledge.

Cite sources inline using [1], [2], etc. matching the source numbers, but ONLY when \
you actually use that source to answer. If the message is a greeting or small talk \
unrelated to the sources, respond naturally and briefly without citing anything -
never cite a source just because it exists.

Sources:
{sources}
"""

NO_DOCUMENTS_MESSAGE = (
    "You haven't uploaded any documents yet. Upload a PDF or text file above "
    "so I have something to answer from - I only answer from what you give me, "
    "not general knowledge."
)

NO_KEY_FALLBACK = (
    "OPENAI_API_KEY isn't configured yet, so I can't embed your question or "
    "generate a grounded answer. Set OPENAI_API_KEY in apps/api's environment "
    "and retry."
)


class ChatMessage(TypedDict):
    role: str
    content: str


class SupportState(TypedDict):
    messages: list[ChatMessage]
    user_id: str
    sources: list[dict]


async def _retrieve(state: SupportState) -> SupportState:
    settings = get_settings()
    if not settings.openai_api_key:
        return {**state, "sources": []}

    last_user_message = next(
        (m["content"] for m in reversed(state["messages"]) if m["role"] == "user"), ""
    )
    sources = await retrieve_chunks(state["user_id"], last_user_message, top_k=TOP_K)
    return {**state, "sources": sources}


async def _generate(state: SupportState) -> SupportState:
    settings = get_settings()
    writer = get_stream_writer()

    if not settings.openai_api_key:
        for word in NO_KEY_FALLBACK.split(" "):
            writer({"token": word + " "})
        return state

    if not state["sources"]:
        for word in NO_DOCUMENTS_MESSAGE.split(" "):
            writer({"token": word + " "})
        return state

    sources_block = "\n\n".join(
        f"[{i + 1}] (from {s['filename']}) {s['content']}"
        for i, s in enumerate(state["sources"])
    )
    system_prompt = SYSTEM_PROMPT.format(sources=sources_block)
    llm_messages = [{"role": "system", "content": system_prompt}, *state["messages"]]

    full_reply = ""
    response = await litellm.acompletion(
        model="gpt-4.1-mini",
        messages=llm_messages,
        stream=True,
        api_key=settings.openai_api_key,
    )
    async for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            full_reply += delta
            writer({"token": delta})

    # Only surface citations the model actually used - retrieval always returns
    # its closest matches even for a greeting or off-topic message, so showing
    # them unconditionally makes the agent look like it's citing things it
    # never really used.
    cited_indices = sorted({int(n) for n in CITATION_PATTERN.findall(full_reply)})
    cited_sources = [
        {**state["sources"][i - 1], "ref_number": i}
        for i in cited_indices
        if 0 < i <= len(state["sources"])
    ]
    if cited_sources:
        writer({"citations": cited_sources})

    return state


def build_graph():
    graph = StateGraph(SupportState)
    graph.add_node("retrieve", _retrieve)
    graph.add_node("generate", _generate)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


_compiled_graph = build_graph()


async def stream_support_reply(user_id: str, messages: list[ChatMessage]) -> AsyncIterator[dict]:
    async for _, payload in _compiled_graph.astream(
        {"messages": messages, "user_id": user_id, "sources": []},
        stream_mode=["custom"],
    ):
        yield payload
