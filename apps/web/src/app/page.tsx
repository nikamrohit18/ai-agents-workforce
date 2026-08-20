import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.65 0.22 264.376) 0%, transparent 70%)",
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
  );
}
