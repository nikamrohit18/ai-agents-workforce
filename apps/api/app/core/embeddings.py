import litellm

from app.core.config import get_settings

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


async def embed_texts(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    response = await litellm.aembedding(
        model=EMBEDDING_MODEL,
        input=texts,
        api_key=settings.openai_api_key,
    )
    return [item["embedding"] for item in response.data]


async def embed_query(text: str) -> list[float]:
    (embedding,) = await embed_texts([text])
    return embedding
