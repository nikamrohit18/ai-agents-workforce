import { Headset, Megaphone, Network, Phone, ShieldCheck, type LucideIcon } from "lucide-react";

export type AgentConfig = {
  name: string;
  description: string;
  href: string;
  status: "live" | "soon";
  icon: LucideIcon;
};

export const agents: AgentConfig[] = [
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
