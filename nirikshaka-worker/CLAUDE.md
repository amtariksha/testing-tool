# Nirikshaka Worker — Claude Code context

## What this is
The agent + test-execution service for Nirikshaka. Six persistent teammates
(Scout, Strategist, Author, Runner, Critic, Analyst) built in phases, coordinated
via a Postgres task table (SKIP LOCKED), shared Supabase state, and Supabase
Realtime mailbox. Runs on Ubuntu via systemd. The Next.js dashboard (../nirikshaka)
stays on Vercel and is NOT rebuilt.

## Non-negotiables
- Read nirikshaka-implementation-doc.md §1–2 before ANY change. Existing
  telemetry routes, SDK, dashboard, Prisma models are DONE — extend, never rewrite.
- Prisma only (no Drizzle). One additive migration per phase, run from ../nirikshaka.
  prisma/schema.prisma here is a COPY — sync with `pnpm sync:schema`, never edit directly.
- Direct @anthropic-ai/sdk. No LangChain/CrewAI. Prompt caching ON. temperature 0
  for runner recovery. Model routing per doc §5.3/§7.2 of PRD v3.
- All prompts in src/llm/prompts/*.md. Never string literals.
- Zod at every agent boundary. No unvalidated Json crossing agents.
- Permission gates in tool registry: Critic = read + critiques only. Runner cannot
  write YAML. Author cannot touch Playwright.
- The Confirmation Gate is law: Strategist/Author must refuse projects without a
  CONFIRMED AppModel.
- Envelope crypto: src/crypto/envelope.ts is duplicated at
  ../nirikshaka/src/lib/crypto/envelope.ts — change both or neither.

## Karpathy rules
1. THINK: state assumptions first; ask if ambiguous.
2. SIMPLE: minimum code that passes the phase gate. No speculative abstraction.
3. SURGICAL: touch only what the task requires; match existing style.
4. GOALS: every phase has a gate (doc §7). Loop until the gate passes. Do not
   start phase N+1 early.

## Files under 300 lines. Vitest for agent core logic. pnpm.

## Commands
- pnpm dev               # worker with tsx watch
- pnpm build             # prisma generate + tsc → dist/
- pnpm test              # vitest
- pnpm sync:schema       # re-copy schema from ../nirikshaka + generate
- pnpm migrate           # delegated to ../nirikshaka prisma migrate deploy
- pnpm gate:0            # Phase 0 verification gate
- pnpm backfill:encrypt  # encrypt legacy APIRequest bodies (idempotent)
