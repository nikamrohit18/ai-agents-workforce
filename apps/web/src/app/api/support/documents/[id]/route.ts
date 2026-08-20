import { auth } from "@clerk/nextjs/server";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;

  const res = await fetch(
    `${backendUrl}/documents/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
