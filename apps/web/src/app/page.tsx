import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <span className="rounded-full border px-3 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        AI Agents Workforce &middot; Platform Kernel
      </span>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance">
        A shared platform for shipping production AI agents, one at a time.
      </h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Auth, database, memory, and orchestration are already wired up. Every
        new agent is a module on top of this kernel.
      </p>
      <div className="flex gap-3">
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
  );
}
