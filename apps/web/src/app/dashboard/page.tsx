import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { agents } from "@/lib/agents";

export default function DashboardHub() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Every agent below runs on the same kernel: this auth, this database, this
          orchestration layer.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const card = (
              <Card
                className={`h-full gap-3 border-border p-5 transition-all duration-200 ${
                  agent.status === "soon"
                    ? "opacity-45"
                    : "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_0_1px_var(--primary)_inset,0_8px_24px_-8px_oklch(0.65_0.22_264.376/0.35)]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  <Badge variant={agent.status === "live" ? "default" : "secondary"}>
                    {agent.status === "live" ? "Live" : "Coming soon"}
                  </Badge>
                </div>
                <div>
                  <h2 className="font-medium">{agent.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{agent.description}</p>
                </div>
              </Card>
            );
            return agent.status === "live" ? (
              <Link key={agent.name} href={agent.href}>
                {card}
              </Link>
            ) : (
              <div key={agent.name}>{card}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
