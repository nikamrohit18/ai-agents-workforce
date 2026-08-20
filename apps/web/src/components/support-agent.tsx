"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function groupCitations(citations: Citation[]) {
  const byDoc = new Map<string, { filename: string; refs: number[] }>();
  citations.forEach((c, i) => {
    const existing = byDoc.get(c.document_id);
    if (existing) {
      existing.refs.push(i + 1);
    } else {
      byDoc.set(c.document_id, { filename: c.filename, refs: [i + 1] });
    }
  });
  return Array.from(byDoc.values());
}

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

function AssistantAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
      <Sparkles className="size-4" />
    </div>
  );
}

function UserAvatar() {
  const { user } = useUser();
  if (user?.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.imageUrl} alt="" className="size-8 shrink-0 rounded-full" />;
  }
  return <div className="size-8 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />;
}

export function SupportAgent() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadDocs() {
    const res = await fetch("/api/support/documents");
    if (res.ok) setDocs(await res.json());
    setDocsLoaded(true);
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
      toast.success(`Indexed ${data.filename}`, {
        description: `${data.chunk_count} chunk${data.chunk_count === 1 ? "" : "s"} embedded and ready to search.`,
      });
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
    <div className="flex flex-1 overflow-hidden">
      {/* Documents sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-muted/30 sm:flex">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-sm font-semibold">Knowledge base</h2>
            <p className="text-xs text-zinc-500">{docs.length} document{docs.length === 1 ? "" : "s"}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <Button
            size="icon-sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload document"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {docsLoaded && docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <UploadCloud className="size-6 text-zinc-400" />
              <p className="text-xs text-zinc-500">
                Upload a PDF or text file to start grounding answers in your own content.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5 p-2">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                >
                  <FileText className="size-4 shrink-0 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate" title={doc.filename}>
                      {doc.filename}
                    </p>
                    <p className="text-xs text-zinc-500">{doc.chunk_count} chunks</p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="shrink-0 text-zinc-400 opacity-0 hover:text-destructive group-hover:opacity-100"
                    aria-label={`Delete ${doc.filename}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Customer Support</h1>
          <p className="text-sm text-zinc-500">
            Answers are grounded only in your uploaded documents, with citations - never
            outside knowledge.
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-zinc-500">
                <Sparkles className="size-6" />
                <p className="text-sm">Ask something about your uploaded documents.</p>
              </div>
            )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const groups = m.citations ? groupCitations(m.citations) : [];
              return (
                <div key={i} className="flex items-start gap-3">
                  {m.role === "assistant" ? <AssistantAvatar /> : <UserAvatar />}
                  <div className="min-w-0 flex-1">
                    {m.content ? (
                      m.role === "assistant" ? (
                        <div className="prose-sm max-w-none text-sm leading-relaxed [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{m.content}</p>
                      )
                    ) : isStreaming && isLast ? (
                      <div className="flex gap-1 py-1">
                        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" />
                      </div>
                    ) : null}
                    {groups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {groups.map((g) => (
                          <Badge key={g.filename} variant="secondary" className="gap-1 text-xs font-normal">
                            <FileText className="size-3" />
                            {g.filename}
                            <span className="text-zinc-400">
                              [{g.refs.join(", ")}]
                            </span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about your documents..."
              disabled={isStreaming}
              className="h-10"
            />
            <Button onClick={handleSend} disabled={isStreaming} size="icon" className="size-10 shrink-0">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
