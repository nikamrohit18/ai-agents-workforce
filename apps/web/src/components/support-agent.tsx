"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Citation = {
  filename: string;
  chunk_index: number;
  document_id: string;
  similarity: number;
};

type Message = { role: "user" | "assistant"; content: string; citations?: Citation[] };

type Doc = { id: string; filename: string; uploaded_at: string; chunk_count: number };

async function streamSupportChat(
  messages: Message[],
  onToken: (token: string) => void,
  onCitations: (citations: Citation[]) => void,
) {
  const res = await fetch("/api/support/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.body) throw new Error("No response body from /api/support/chat");

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
      const lines = raw.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const eventType = eventLine ? eventLine.slice(6).trim() : "message";
      try {
        const parsed = JSON.parse(dataLine.slice(5).trim());
        if (eventType === "token" && parsed.token) onToken(parsed.token);
        if (eventType === "citations" && parsed.citations) onCitations(parsed.citations);
      } catch {
        // ignore malformed/keepalive chunks
      }
    }
  }
}

export function SupportAgent() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadDocs() {
    const res = await fetch("/api/support/documents");
    if (res.ok) setDocs(await res.json());
  }

  useEffect(() => {
    loadDocs();
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/support/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Upload failed");
        return;
      }
      toast.success(`Indexed ${data.filename} (${data.chunk_count} chunks)`);
      await loadDocs();
    } catch {
      toast.error("Upload failed - is the agent backend running?");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/support/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } else {
      toast.error("Delete failed");
    }
  }

  async function handleSend() {
    if (!input.trim() || isStreaming) return;
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      await streamSupportChat(
        [...messages, userMessage],
        (token) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + token,
            };
            return updated;
          });
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        },
        (citations) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], citations };
            return updated;
          });
        },
      );
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error reaching the agent backend." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customer Support</h1>
        <p className="text-sm text-zinc-500">
          Upload documents, then ask questions. Answers are grounded only in what
          you upload - no outside knowledge, every answer cites its source.
        </p>
      </div>

      <Card className="gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Documents</span>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-zinc-500">No documents yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between text-sm">
                <span>
                  {doc.filename}{" "}
                  <span className="text-zinc-400">({doc.chunk_count} chunks)</span>
                </span>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-zinc-400 hover:text-destructive"
                  aria-label={`Delete ${doc.filename}`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-500">Ask something about your uploaded documents.</p>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[85%]"}>
                <div
                  className={
                    m.role === "user"
                      ? "rounded-lg bg-foreground px-3 py-2 text-sm text-background"
                      : "rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800"
                  }
                >
                  {m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.citations.map((c, ci) => (
                      <Badge key={ci} variant="secondary" className="text-xs">
                        [{ci + 1}] {c.filename}
                      </Badge>
                    ))}
                  </div>
                )}
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
          placeholder="Ask about your documents..."
          disabled={isStreaming}
        />
        <Button onClick={handleSend} disabled={isStreaming}>
          Send
        </Button>
      </div>
    </div>
  );
}
