"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type Message = { role: "user" | "assistant"; content: string };

async function streamChat(
  messages: Message[],
  onToken: (token: string) => void,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.body) throw new Error("No response body from /api/chat");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      try {
        const parsed = JSON.parse(json);
        if (parsed.token) onToken(parsed.token);
      } catch {
        // ignore malformed/keepalive chunks
      }
    }
  }
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    if (!input.trim() || isStreaming) return;
    const userMessage: Message = { role: "user", content: input };
    const nextMessages = [...messages, userMessage, { role: "assistant" as const, content: "" }];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);

    try {
      await streamChat([...messages, userMessage], (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + token,
          };
          return updated;
        });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error reaching the agent backend. Is apps/api running?" },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-500">
              This is the walking-skeleton agent. Send a message to see it
              stream through Next.js -&gt; FastAPI -&gt; LangGraph -&gt; back.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[80%] rounded-lg bg-foreground px-3 py-2 text-sm text-background"
                    : "mr-auto max-w-[80%] rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800"
                }
              >
                {m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </ScrollArea>
      </Card>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask the demo agent something..."
          disabled={isStreaming}
        />
        <Button onClick={handleSend} disabled={isStreaming}>
          Send
        </Button>
      </div>
    </div>
  );
}
