# AI Agents Workforce

A shared platform kernel (auth, database, streaming) for shipping production-grade AI agents one at a time. Public portfolio repo — showcased to recruiters and intended to be sold as freelance/productized work, **not** open-sourced for reuse. See `LICENSE` (proprietary, all-rights-reserved — do not change to MIT/etc. without being asked).

## Architecture

Monorepo, two apps sharing one platform kernel:

- `apps/web` — Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Base UI primitives, `--base base-ui`). Clerk auth, dashboard shell, one page per agent.
- `apps/api` — FastAPI + LangGraph (Python). Each agent is a compiled, streamable LangGraph graph, not a bare prompt. Deployed on Vercel as Python Functions (Fluid Compute).
- `infra/docker-compose.yml` — local infra (if used for dev services).
- `docs/screenshots/` — real product screenshots referenced from the root README; recapture these when the UI changes materially.

Data layer: Neon Postgres with `pgvector` (HNSW index) for RAG retrieval, Upstash Redis for caching/rate-limiting. LiteLLM is the LLM/embeddings gateway — code should stay provider-agnostic through it rather than hard-wiring to one vendor's SDK.

**Kernel-per-agent model:** auth, DB access, and the SSE streaming pattern are built once in the kernel. A new agent = a new LangGraph graph under `apps/api/app/agents/`, a new API route under `apps/api/app/api/`, and a new page/component under `apps/web/src/app/dashboard/`, registered in `apps/web/src/lib/agents.ts` (drives both the sidebar nav and the dashboard hub grid).

## Shipped agents

- **Customer Support RAG** (`apps/api/app/agents/support_agent.py`, `apps/web/src/components/support-agent.tsx`) — retrieve → generate graph. Upload PDF/text → pypdf extraction → `langchain-text-splitters` chunking → OpenAI `text-embedding-3-small` embeddings → pgvector cosine retrieval → LLM generation with `[n]` citation markers. Citations are only surfaced for markers the model's own output actually contains (parsed via regex post-generation) — retrieval always returns its closest matches even for greetings/off-topic messages, so never show citations unconditionally.

Next agent floated but **not yet started**: Voice Receptionist. Don't start a new agent without an explicit go-ahead.

## Conventions that matter here

**UI bar is "sellable SaaS," not "it works."** This is a portfolio/sales product — default to a deliberate design pass (dark-mode-first, persistent app shell, consistent single accent color, real empty/loading states), not a minimal functional layout. Use the `vercel:shadcn` skill's design-direction guidance proactively.

- Dark-mode-first: `<html>` has `dark` class; single indigo/violet accent `oklch(0.65 0.22 264.376)` threaded through `--primary` / `--ring` / `--sidebar-primary` in `globals.css`.
- `@theme inline` font vars must use **literal** font family names (`"Geist", "Geist Fallback", ...`), never `var(--font-sans)` or `var(--font-geist-sans)` — Tailwind v4 resolves `@theme inline` at parse time, before Next.js injects the runtime font variable. A self-referential `--font-sans: var(--font-sans)` silently falls back to the browser default serif with no error.
- Base UI (not Radix) primitives: no `asChild` prop — use the `render` prop, and pass `nativeButton={false}` when rendering a non-native-button element (e.g. `<Button render={<Link .../>} nativeButton={false} />`).
- Scroll containers: native `overflow-y-auto` + `min-h-0` on `flex-1` children, with the themed `::-webkit-scrollbar` rules in `globals.css`. Do not reach for shadcn's `ScrollArea` — it was deliberately removed from this project after a real bug (thumb at 10% opacity in dark mode, and a missing `min-h-0` meant the scroll container grew to fit all content instead of being bounded, so nothing was ever scrollable).
- `middleware.ts` is `proxy.ts` in this Next.js version (`apps/web/src/proxy.ts`).

**README/LICENSE:** keep the public README recruiter/client-facing — tech stack, architecture, usage, real screenshots. No internal week-by-week timelines or freelance pricing/costing; those are planning details, not public repo content.

**Verification standard:** after implementing a feature, actually exercise it (browser click-through or direct API calls) before calling it done — several real bugs here (invisible scrollbar, citations shown on plain greetings) only surfaced that way, not through code review. When asked to "retest," do a full pass (e.g. full CRUD) rather than a happy-path spot check.

## Local dev

```bash
# web (from apps/web)
npm run dev        # apps/web/.env.local holds OPENAI_API_KEY, Clerk keys, etc.

# api (from apps/api)
# .venv already present; .env holds DATABASE_URL, REDIS_URL, OPENAI_API_KEY
uvicorn app.main:app --reload
```

Migrations: `apps/api/scripts/migrate.py` — idempotent pgvector schema setup (documents/chunks tables + HNSW index), run manually against Neon.

Env vars are provisioned via Vercel Marketplace (`vercel integration add ...`) where possible; when setting them manually via `vercel env add`, pipe values through stdin rather than shell-substituting them as arguments (shell substitution has corrupted `DATABASE_URL`/`REDIS_URL`/`CLERK_SECRET_KEY` here before by embedding stray quote characters).
