# AI Agents Workforce

A shared platform ("kernel") for shipping production-grade AI agents, one at a time. Every agent is a module built on top of the same auth, database, memory, and orchestration layer instead of a one-off throwaway demo.

Built as a portfolio + freelance product line: each agent ships polished, deployed, and documented well enough to (a) show a recruiter and (b) sell to a client.

**Live:**
- Frontend: https://web-rose-omega-72.vercel.app
- Customer Support agent: https://web-rose-omega-72.vercel.app/dashboard/support
- Backend API: https://api-indol-nu-61.vercel.app/health

## Architecture

```mermaid
flowchart LR
    User((Browser)) --> Web["Next.js 16 (apps/web)\nClerk auth + shadcn/ui"]
    Web -->|"/api/* (auth-checked)"| API["FastAPI (apps/api)"]
    API --> Graph["LangGraph agent graphs"]
    Graph --> LLM["LLM providers via LiteLLM\n(Anthropic / OpenAI / ...)"]
    Web --- Clerk[(Clerk)]
    API --- PG[(Neon Postgres)]
    API --- Redis[(Upstash Redis)]
```

- **Frontend**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind, shadcn/ui (Base UI), Clerk for auth. Deployed as a Vercel Function.
- **API layer**: FastAPI, also deployed as a Vercel Function (Fluid Compute, Python runtime) — no separate backend host needed at this scale. Verifies the caller is authenticated, then proxies to the agent backend and streams the response back over SSE.
- **Agent orchestration**: LangGraph. Every agent is a compiled graph. `echo` is the one-node walking-skeleton graph that proved the plumbing works; `support` is the first real agent - a `retrieve -> generate` graph grounded in pgvector search over the caller's own uploaded documents.
- **LLM access**: LiteLLM as the provider gateway, so agents aren't hard-wired to one vendor.
- **Data**: Neon Postgres (serverless, with `pgvector` + HNSW index for embeddings) for persistent state, Upstash Redis for memory/cache/rate-limiting.
- **Auth**: Clerk, provisioned via the Vercel Marketplace, protecting both pages (`proxy.ts`) and API routes.

> Originally planned to split the backend onto Railway. Railway's free trial had expired by the time we deployed, and rather than add billing there, the FastAPI app moved onto Vercel's Python runtime instead — one platform, one bill, and it has enough headroom (300s timeout, WebSocket support, 5GB package limit) for everything through the RAG and voice agents. Revisit a dedicated host only if an agent needs a real persistent worker (e.g. Celery for long-running outreach sequences).

## Repo structure

```
apps/
  web/    Next.js frontend (dashboard, auth, chat UI)
  api/    FastAPI + LangGraph backend
infra/
  docker-compose.yml   local Postgres/Redis + api, for dev without cloud accounts
docs/
```

Future agents (RAG support bot, voice receptionist, SDR, insurance claims, multi-agent orchestrator) land as new graphs under `apps/api/app/agents/` and new routed pages under `apps/web/src/app/`, reusing this same kernel rather than starting a new repo each time.

## Local development

**Frontend** (`apps/web`):
```bash
npm install
vercel env pull .env.local   # or copy .env.example and fill in manually
npm run dev
```

**Backend** (`apps/api`):
```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # .venv/bin/pip on macOS/Linux
cp .env.example .env   # fill in DATABASE_URL / REDIS_URL / an LLM key
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Without an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` set, the demo agent streams a canned explanation instead of a real model response — the graph, SSE plumbing, and auth all still work, so you can verify the whole stack before paying for a single token.

Prefer containers? `docker compose -f infra/docker-compose.yml up` runs Postgres + Redis + the API locally, no cloud accounts required (the frontend still needs its own Clerk/Vercel setup for auth).

## Status

- [x] Auth (Clerk) wired into pages and API routes, enforced in `proxy.ts`
- [x] Postgres (Neon) and Redis (Upstash) provisioned and connected
- [x] FastAPI + LangGraph backend with a real streamed SSE agent response
- [x] Next.js chat UI consuming the stream end to end (verified in-browser, not just compiled)
- [x] Deployed to production (both apps on Vercel) — verified with a real sign-up + live chat, not just a green build
- [x] **Customer Support RAG agent** — PDF/text upload, chunking, OpenAI embeddings, pgvector similarity search, cited answers. Verified end to end in production with a real document and a question only answerable from it.
- [x] Agent hub at `/dashboard` (card grid, one entry per agent) - the pattern every future agent slots into
- [ ] Auto-deploy on push — the Vercel CLI's `git connect` hit a monorepo detection quirk; connect each project (`web`, `api`) to this repo manually under **Project Settings -> Git** in the Vercel dashboard, then set **Root Directory** to `apps/web` / `apps/api` respectively. Two minutes, not worth CLI-fighting further.
- [ ] Hybrid search / reranking / parent-child chunking for the support agent — current retrieval is plain cosine similarity, good enough to prove the pattern, worth revisiting before selling it

**Known gotcha worth remembering**: env vars copied between `.env` files and `vercel env add` via shell variable substitution can silently pick up stray quote characters and get stored as an empty/invalid value on Vercel - it won't show up locally, only in production, and `vercel env pull` doesn't reliably reveal it either (it appears to mask sensitive values). Hit this with `DATABASE_URL` and had to remove + re-add via stdin. If a Vercel deployment behaves differently from local for no obvious reason, suspect this first.

## Roadmap (full-time pace, ~8-9h/day)

This is the honest version, not the marketing version. At sustained full-time effort the platform-plus-five-agents portfolio compresses from ~8-9 months (part-time) to roughly **10-11 weeks**. That pace is genuinely aggressive — there's no slack in it for the inevitable surprise (a flaky third-party API, a broken SDK upgrade like the Base UI `asChild` change we hit on day one). Treat the weekly boundaries as targets, not guarantees.

| Weeks | Deliverable | Status |
|---|---|---|
| 1-2 | Kernel + **Customer Support RAG agent** — auth, DB, streaming, upload, chunking, embeddings, pgvector, citations | **Done** |
| 3-4 | **Voice Receptionist + missed-call text-back** — Twilio, Deepgram STT, Calendar booking, SMS confirmation | Next. Highest-$ freelance category right now (SMB clinics/salons/contractors pay $99-299/mo for this today). Likely the first agent that lives on the Hostinger VPS instead of Vercel, since Twilio's real-time audio wants a persistent connection, not a serverless function |
| 5-6 | **AI SDR / Lead-Gen agent** — research, scoring, personalized outreach, HubSpot sync, CSV export | Real B2B budget line; demonstrates multi-step agent chains, not just chat |
| 7-8 | **Insurance Claims Intake & Triage** (flagship) — OCR, fraud scoring, policy lookup, mandatory human-in-loop approval | The one project nobody else's portfolio has; grounded in real domain expertise, not generic |
| 9-10 | **Multi-agent orchestration** — wire Reception -> Sales -> CRM -> Calendar -> Analytics through a LangGraph supervisor | Built from parts already shipped, not from scratch; this is the flagship recruiters remember |
| 11 | Polish pass: Langfuse + Sentry across every repo, architecture diagrams, README pass, portfolio site, all demo videos; point `agents.rohitnikam.tech` at the hub | Unfinished polish is what makes a portfolio look unfinished |

## License

MIT
