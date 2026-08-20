import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Headset, Megaphone, Network, Phone, ShieldCheck, type LucideIcon } from "lucide-react";

type AgentCard = {
  name: string;
  description: string;
  href: string;
  status: "live" | "soon";
  icon: LucideIcon;
};

const agents: AgentCard[] = [
  {
    name: "Customer Support",
    description: "RAG agent grounded in your uploaded documents, with citations.",
    href: "/dashboard/support",
    status: "live",
    icon: Headset,
  },
  {
    name: "Lead-Gen SDR",
    description: "Research, score, and draft personalized outreach.",
    href: "#",
    status: "soon",
    icon: Megaphone,
  },
  {
    name: "Voice Receptionist",
    description: "Answers calls, books appointments, texts back missed calls.",
    href: "#",
    status: "soon",
    icon: Phone,
  },
  {
    name: "Insurance Claims Triage",
    description: "OCR intake, fraud scoring, policy lookup, human-in-loop approval.",
    href: "#",
    status: "soon",
    icon: ShieldCheck,
  },
  {
    name: "Multi-Agent Orchestrator",
    description: "Reception -> Sales -> CRM -> Calendar -> Analytics, supervised.",
    href: "#",
    status: "soon",
    icon: Network,
  },
];

export default function DashboardHub() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="mb-8 text-sm text-zinc-500">
          Every agent below runs on the same kernel: this auth, this database, this
          orchestration layer.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const card = (
              <Card
                className={`h-full gap-3 p-5 transition-colors ${
                  agent.status === "soon"
                    ? "opacity-50"
                    : "hover:border-foreground/30 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4.5" />
                  </div>
                  <Badge variant={agent.status === "live" ? "default" : "secondary"}>
                    {agent.status === "live" ? "Live" : "Coming soon"}
                  </Badge>
                </div>
                <div>
                  <h2 className="font-medium">{agent.name}</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">{agent.description}</p>
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
