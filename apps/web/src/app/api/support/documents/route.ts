import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch(`${backendUrl}/documents?user_id=${encodeURIComponent(userId)}`, {
    cache: "no-store",
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const incoming = await req.formData();
  const file = incoming.get("file");
  if (!file) {
    return new Response(JSON.stringify({ detail: "No file provided" }), { status: 400 });
  }

  const outgoing = new FormData();
  outgoing.set("user_id", userId);
  outgoing.set("file", file);

  const res = await fetch(`${backendUrl}/documents/upload`, {
    method: "POST",
    body: outgoing,
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
