from app.core.db import get_pool
from app.core.embeddings import embed_query


async def retrieve_chunks(user_id: str, query: str, top_k: int = 5) -> list[dict]:
    query_embedding = await embed_query(query)

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                c.content,
                c.chunk_index,
                d.filename,
                d.id AS document_id,
                1 - (c.embedding <=> $1) AS similarity
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE d.user_id = $2
            ORDER BY c.embedding <=> $1
            LIMIT $3
            """,
            query_embedding,
            user_id,
            top_k,
        )

    return [
        {
            "content": row["content"],
            "chunk_index": row["chunk_index"],
            "filename": row["filename"],
            "document_id": str(row["document_id"]),
            "similarity": float(row["similarity"]),
        }
        for row in rows
    ]
