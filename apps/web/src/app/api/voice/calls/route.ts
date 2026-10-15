import { auth } from "@clerk/nextjs/server";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch(`${backendUrl}/agents/voice/calls?user_id=${encodeURIComponent(userId)}`, {
    cache: "no-store",
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
