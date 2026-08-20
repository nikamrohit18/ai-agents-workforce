import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AgentCard = {
  name: string;
  description: string;
  href: string;
  status: "live" | "soon";
};

const agents: AgentCard[] = [
  {
    name: "Customer Support",
    description: "RAG agent grounded in your uploaded documents, with citations.",
    href: "/dashboard/support",
    status: "live",
  },
  {
    name: "Lead-Gen SDR",
    description: "Research, score, and draft personalized outreach.",
    href: "#",
    status: "soon",
  },
  {
    name: "Voice Receptionist",
    description: "Answers calls, books appointments, texts back missed calls.",
    href: "#",
    status: "soon",
  },
  {
    name: "Insurance Claims Triage",
    description: "OCR intake, fraud scoring, policy lookup, human-in-loop approval.",
    href: "#",
    status: "soon",
  },
  {
    name: "Multi-Agent Orchestrator",
    description: "Reception -> Sales -> CRM -> Calendar -> Analytics, supervised.",
    href: "#",
    status: "soon",
  },
];

export default function DashboardHub() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-6">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Agents</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Every agent below runs on the same kernel: this auth, this database, this
        orchestration layer.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {agents.map((agent) => {
          const card = (
            <Card
              className={`h-full gap-2 p-5 ${
                agent.status === "soon" ? "opacity-60" : "hover:border-foreground/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{agent.name}</h2>
                <Badge variant={agent.status === "live" ? "default" : "secondary"}>
                  {agent.status === "live" ? "Live" : "Coming soon"}
                </Badge>
              </div>
              <p className="text-sm text-zinc-500">{agent.description}</p>
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
  );
}
