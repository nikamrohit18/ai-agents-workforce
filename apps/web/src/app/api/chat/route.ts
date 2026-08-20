import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

  const backendRes = await fetch(`${backendUrl}/agents/echo/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, user_id: userId }),
  });

  if (!backendRes.ok || !backendRes.body) {
    return new Response("Agent backend unavailable", { status: 502 });
  }

  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
