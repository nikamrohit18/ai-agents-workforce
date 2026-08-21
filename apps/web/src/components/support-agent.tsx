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
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Citation = {
  filename: string;
  chunk_index: number;
  document_id: string;
  similarity: number;
  ref_number: number;
};

type Message = { role: "user" | "assistant"; content: string; citations?: Citation[] };

type Doc = { id: string; filename: string; uploaded_at: string; chunk_count: number };

function groupCitations(citations: Citation[]) {
  const byDoc = new Map<string, { filename: string; refs: number[] }>();
  citations.forEach((c) => {
    const existing = byDoc.get(c.document_id);
    if (existing) {
      existing.refs.push(c.ref_number);
    } else {
      byDoc.set(c.document_id, { filename: c.filename, refs: [c.ref_number] });
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
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-400 text-primary-foreground shadow-[0_0_0_1px_var(--border)]">
      <Sparkles className="size-4" />
    </div>
  );
}

function UserAvatar() {
  const { user } = useUser();
  if (user?.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.imageUrl}
        alt=""
        className="size-8 shrink-0 rounded-full ring-2 ring-primary/25"
      />
    );
  }
  return <div className="size-8 shrink-0 rounded-full bg-muted ring-2 ring-primary/25" />;
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
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sm:flex">
        <div className="flex items-center justify-between border-b border-sidebar-border p-4">
          <div>
            <h2 className="text-sm font-semibold text-sidebar-foreground">Knowledge base</h2>
            <p className="text-xs text-muted-foreground">
              {docs.length} document{docs.length === 1 ? "" : "s"}
            </p>
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
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload document"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!docsLoaded ? (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-2 py-2">
                  <Skeleton className="size-7 shrink-0 rounded-md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : docsLoaded && docs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
                <UploadCloud className="size-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a PDF or text file to start grounding answers in your own content.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5 p-2">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate" title={doc.filename}>
                      {doc.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">{doc.chunk_count} chunks</p>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                    aria-label={`Delete ${doc.filename}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Customer Support</h1>
              <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                <ShieldCheck className="size-3" />
                Grounded
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Answers are grounded only in your uploaded documents, with citations - never
              outside knowledge.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-violet-400/10">
                  <Sparkles className="size-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Ask something about your uploaded documents.
                </p>
              </div>
            )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const groups = m.citations ? groupCitations(m.citations) : [];
              const isUser = m.role === "user";
              return (
                <div key={i} className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                  {isUser ? <UserAvatar /> : <AssistantAvatar />}
                  <div className={`flex min-w-0 flex-1 flex-col ${isUser ? "items-end" : "items-start"}`}>
                    {m.content ? (
                      isUser ? (
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
                          {m.content}
                        </div>
                      ) : (
                        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed shadow-sm [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      )
                    ) : isStreaming && isLast ? (
                      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-primary" />
                      </div>
                    ) : null}
                    {groups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {groups.map((g) => (
                          <Badge
                            key={g.filename}
                            variant="outline"
                            className="gap-1 border-primary/25 bg-primary/5 text-xs font-normal text-foreground"
                          >
                            <FileText className="size-3 text-primary" />
                            {g.filename}
                            <span className="text-muted-foreground">[{g.refs.join(", ")}]</span>
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
        </div>

        <div className="border-t border-border bg-background/80 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm transition-shadow focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_oklch(0.65_0.22_264.376/0.15)]">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about your documents..."
              disabled={isStreaming}
              className="h-9 rounded-full border-none bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              onClick={handleSend}
              disabled={isStreaming}
              size="icon"
              className="size-9 shrink-0 rounded-full"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
