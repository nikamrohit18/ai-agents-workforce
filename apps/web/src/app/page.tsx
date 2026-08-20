import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Code2, KeyRound, Sparkles, Workflow, Zap } from "lucide-react";

const features = [
  {
    icon: KeyRound,
    title: "Auth built in",
    description: "Every page and API route is protected by default, not left to convention.",
  },
  {
    icon: Workflow,
    title: "LangGraph orchestration",
    description: "Every agent is a compiled, streamable graph - not a single prompt with no memory.",
  },
  {
    icon: Zap,
    title: "One kernel, many agents",
    description: "New agents plug into the same auth, database, and streaming layer already wired up.",
  },
];

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet-400 text-primary-foreground">
            <Sparkles className="size-3.5" />
          </span>
          AI Agents Workforce
        </Link>
        <div className="flex items-center gap-3">
          {userId ? (
            <Button size="sm" nativeButton={false} render={<Link href="/dashboard">Dashboard</Link>} />
          ) : (
            <>
              <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/sign-in">Sign in</Link>} />
              <Button size="sm" nativeButton={false} render={<Link href="/sign-up">Get started</Link>} />
            </>
          )}
        </div>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[120px]"
          style={{
            background: "radial-gradient(circle, oklch(0.65 0.22 264.376) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="size-3 text-primary" />
            AI Agents Workforce &middot; Platform Kernel
          </span>

          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            A shared platform for shipping{" "}
            <span className="bg-gradient-to-r from-primary to-violet-300 bg-clip-text text-transparent">
              production AI agents
            </span>
            , one at a time.
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            Auth, database, memory, and orchestration are already wired up. Every
            new agent is a module on top of this kernel.
          </p>

          <div className="mt-2 flex gap-3">
            {userId ? (
              <Button size="lg" nativeButton={false} render={<Link href="/dashboard">Go to dashboard</Link>} />
            ) : (
              <>
                <Button size="lg" nativeButton={false} render={<Link href="/sign-up">Get started</Link>} />
                <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/sign-in">Sign in</Link>} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-4.5" />
              </div>
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-border px-6 py-5 text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} Rohit Nikam. All rights reserved.</span>
        <a
          href="https://github.com/nikamrohit18/ai-agents-workforce"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 hover:text-foreground"
        >
          <Code2 className="size-3.5" />
          Source
        </a>
      </footer>
    </div>
  );
}
