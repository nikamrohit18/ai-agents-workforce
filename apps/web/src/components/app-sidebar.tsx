"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronsUpDown, LayoutGrid, LogOut, Settings, Sparkles } from "lucide-react";
import { agents } from "@/lib/agents";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet-400 text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          AI Agents Workforce
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <Link
          href="/dashboard"
          className={`mb-4 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
            pathname === "/dashboard"
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          }`}
        >
          <LayoutGrid className="size-4" />
          Overview
        </Link>

        <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Agents
        </p>
        <div className="flex flex-col gap-0.5">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const isActive = pathname === agent.href;
            const isLive = agent.status === "live";
            const content = (
              <div
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                    : isLive
                      ? "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      : "cursor-default text-muted-foreground/50"
                }`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                {!isLive && (
                  <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px] font-normal">
                    Soon
                  </Badge>
                )}
              </div>
            );
            return isLive ? (
              <Link key={agent.name} href={agent.href}>
                {content}
              </Link>
            ) : (
              <div key={agent.name}>{content}</div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent">
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.imageUrl} alt="" className="size-7 shrink-0 rounded-full" />
            ) : (
              <div className="size-7 shrink-0 rounded-full bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem onClick={() => openUserProfile()}>
              <Settings className="size-4" />
              Manage account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => signOut({ redirectUrl: "/" })}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
