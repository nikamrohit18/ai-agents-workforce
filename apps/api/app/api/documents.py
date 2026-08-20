from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import get_settings
from app.core.db import get_pool
from app.services.ingestion import ingest_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(user_id: str = Form(...), file: UploadFile = File(...)):
    if not get_settings().openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY isn't configured, so documents can't be embedded yet.",
        )
    data = await file.read()
    try:
        return await ingest_document(user_id, file.filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("")
async def list_documents(user_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT d.id, d.filename, d.uploaded_at, COUNT(c.id) AS chunk_count
            FROM documents d
            LEFT JOIN chunks c ON c.document_id = d.id
            WHERE d.user_id = $1
            GROUP BY d.id
            ORDER BY d.uploaded_at DESC
            """,
            user_id,
        )
    return [
        {
            "id": str(row["id"]),
            "filename": row["filename"],
            "uploaded_at": row["uploaded_at"].isoformat(),
            "chunk_count": row["chunk_count"],
        }
        for row in rows
    ]


@router.delete("/{document_id}")
async def delete_document(document_id: str, user_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM documents WHERE id = $1 AND user_id = $2",
            document_id,
            user_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": document_id}
