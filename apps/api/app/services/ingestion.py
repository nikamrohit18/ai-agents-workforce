import io
import uuid

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from app.core.db import get_pool
from app.core.embeddings import embed_texts

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
)


def extract_text(filename: str, data: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return data.decode("utf-8", errors="ignore")


async def ingest_document(user_id: str, filename: str, data: bytes) -> dict:
    text = extract_text(filename, data)
    if not text.strip():
        raise ValueError("No extractable text found in this file.")

    chunks = _splitter.split_text(text)
    if not chunks:
        raise ValueError("Document produced no chunks after splitting.")

    embeddings = await embed_texts(chunks)

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            document_id = await conn.fetchval(
                "INSERT INTO documents (user_id, filename) VALUES ($1, $2) RETURNING id",
                user_id,
                filename,
            )
            await conn.executemany(
                """
                INSERT INTO chunks (id, document_id, chunk_index, content, embedding)
                VALUES ($1, $2, $3, $4, $5)
                """,
                [
                    (uuid.uuid4(), document_id, i, chunk, embeddings[i])
                    for i, chunk in enumerate(chunks)
                ],
            )

    return {"document_id": str(document_id), "filename": filename, "chunk_count": len(chunks)}
