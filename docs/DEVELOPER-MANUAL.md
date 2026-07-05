# Nirikshaka — Developer Manual

**Audience:** developers using Nirikshaka to monitor an app, build a confirmed
App Model from it, and generate + run agent tests. Everything user-facing
happens in the **web dashboard** (deployed on Vercel — e.g.
`https://testing-tool-weld.vercel.app`). One background service (the **worker**)
must be running for agent features — see [§2](#2-system-topology).

**Product state:** Phases 0–4 built. Telemetry + Scout + Confirmation Gate
(monitoring & understanding), Runner + Truth Check + MCP (execution), Strategist
+ Author + review queue (test generation), Analyst + scheduler + hardening
(flake/drift/cost/staleness). Phase 5 (Figma, mobile/Maestro, plugin-less proxy,
PDF/YAML spec parsing) remains deferred — see [§9](#9-whats-implemented-vs-deferred).

---

## 1. What Nirikshaka does

Nirikshaka is a QA platform with two halves that feed each other:

1. **Monitoring** (live): your app sends telemetry — API request logs, crashes,
   UI errors, and user journeys — via an SDK. The dashboard shows all of it in
   real time.
2. **Agents**: a team (Scout, Critic, Runner, Strategist, Author, Analyst) that
   *understands your app before testing it*. Scout mines telemetry + product
   docs into an **App Model** — features, screens, flows, APIs, business rules —
   which **you confirm in the dashboard before any test is ever generated** (the
   **Confirmation Gate**, the core product rule). From a confirmed model the
   Strategist plans coverage, the Author writes YAML tests, the Runner executes
   them with Playwright, and the Critic's **Truth Check** cross-references
   backend telemetry to produce a **tri-state verdict**:

   - **GREEN** — UI passed and the backend was clean.
   - **AMBER** — UI passed but the backend showed a 5xx / crash / missing
     expected call: a *silent failure* no pure-testing or pure-monitoring tool
     catches.
   - **RED** — UI failed.

---

## 2. System topology

```
Browser ─▶ Dashboard (Next.js on Vercel) ─▶ Supabase Postgres ◀─ Worker (Ubuntu box, Node 22)
              │  /api/track/*  (SDK telemetry in)      ▲              │ claims agent tasks (SKIP LOCKED)
              │  /api/agent/*  (enqueue + status)      │              │ Scout/Critic/Runner/Strategist/
              │  dashboard pages (results out) ────────┘              │   Author/Analyst
              └─ realtime "agent:tasks" events                        └ MCP server (separate process)
```

- **Dashboard (Vercel)** — the UI; ingests telemetry; enqueues agent tasks as
  rows in `agent_tasks`.
- **Worker (Ubuntu, systemd)** — headless. Polls `agent_tasks`
  (`FOR UPDATE SKIP LOCKED`), runs the agents, drives Playwright, writes results
  back. An internal scheduler enqueues the nightly Analyst sweep. **If the
  worker is down, agent tasks queue and nothing processes them** — monitoring
  keeps working. The dashboard shows an **Agents online/offline** badge
  (reads `agent_heartbeats`).
- **MCP server** — a *separate* worker process (stdio for local Claude Code,
  Streamable HTTP for remote) exposing three tools ([§7](#7-mcp-server)).
- **Supabase** — shared Postgres (source of truth) + Realtime channel
  `agent:tasks` for live agent events.

Request/response bodies in telemetry are envelope-encrypted at rest
(AES-256-GCM), transparently decrypted when displayed. The Truth Check reads
only plaintext columns (status codes, paths) — never the encrypted bodies.

---

## 3. One-time setup (admin)

Skip if the platform is already running.

| What | Where | Notes |
|---|---|---|
| `DATABASE_URL` | Vercel env | **Supabase Session-Pooler URL** (`postgres.<ref>@aws-1-<region>.pooler.supabase.com:5432`) — Vercel is IPv4-only; the direct `db.<ref>.supabase.co` host is IPv6-only. Percent-encode password specials (`#`→`%23`). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | Auth + realtime in the browser. |
| `NIRIKSHAKA_MASTER_KEY` | Vercel env + worker `.env` | 32-byte hex (`openssl rand -hex 32`). Same value both sides. |
| `AGENT_SHARED_SECRET` | Vercel env + worker `.env` | Auth for headless `/api/agent/*` calls and the MCP HTTP transport. Same value both sides. |
| Root Directory = `nirikshaka`, Framework = **Next.js** | Vercel project settings | Monorepo — both required or deploys serve 404s. |
| Deployment Protection = *Only Preview Deployments* | Vercel project settings | Otherwise SDKs/users are blocked by Vercel SSO. |
| Worker service | Ubuntu box | See [§8 deploy checklist](#8-deploy-checklist). |
| DB migrations | `nirikshaka/` | `npx prisma migrate deploy` (history baselined). |

**Worker `.env`** (`nirikshaka-worker/.env.example` is the template): `DATABASE_URL`
(direct host is fine here), `ANTHROPIC_API_KEY`, `NIRIKSHAKA_MASTER_KEY`,
`AGENT_SHARED_SECRET`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`,
`WACRM_WEBHOOK_URL` (optional), `DASHBOARD_URL` (for notification links), plus
runner/MCP/analyst knobs (all have defaults).

Deploys: push to `main` → Vercel builds the dashboard. The worker is **not**
auto-deployed — see [§8](#8-deploy-checklist).

---

## 4. Workflow — monitor → confirm the App Model

1. **Register** and **create a project** (Projects → New Project). Each app is
   its own project (CommunityOS = three: resident Flutter, guard, admin web).
2. **Instrument** your app (SDKs page snippet for web; `nirikshaka_plugin` for
   Flutter). Verify telemetry lands in **API Monitoring / Journeys / Crashes /
   UI Errors**.
3. **Intelligence → App Model** (Confirmation Gate):
   - **Run Scout**: paste (or **attach** `.md`/`.txt`) your PRD and optionally
     an OpenAPI JSON (attach `.json`). The **progress chip** shows the pipeline
     live (Scout mining → Critic reviewing → done/failed), the model
     auto-refreshes when it settles, and task errors surface inline.
   - Review **feature cards** (confidence + evidence links), the **Critic
     verdict**, the **discrepancy inbox**, and the **explain-back panel** (Scout's
     5-line summary per feature — if the summary is wrong, the model is wrong).
   - Act **per feature**: Approve / Edit / Reject / Mark critical-path. Resolve
     discrepancies. Answer Scout's **targeted questions** and *Submit & re-fuse*
     (answers become evidence and trigger a new Scout run).
   - **Confirm model** → status `CONFIRMED` (blocked while any feature is
     rejected). Only confirmed models feed test generation. The **version
     browser** shows historical versions read-only.
   - If the Critic rejects a model 3× it escalates to human review (a banner),
     instead of silently looping.

---

## 5. Workflow — generate tests → review → run

1. **Intelligence → Test Cases**. With a CONFIRMED model, click **Plan &
   generate tests**: the Strategist plans a coverage matrix (only from the
   CONFIRMED model — it refuses otherwise), the Author writes one YAML case per
   budget slot, and the Critic reviews each (deterministic lint + LLM). Cases
   arrive **DRAFT / needs-review**.
2. Review the queue (grouped by suite): read the YAML, see Critic findings,
   then **Approve** (→ ACTIVE), **Regenerate** (re-authors with the findings),
   or **Retire**. **Approve all** per suite skips `needs-human` cases. Cases the
   Critic rejected 3× or flagged for product judgment sit in **Needs human**.
3. **Import a manual catalog** (optional): worker
   `pnpm import:md --project <id> --file cases.md --suite <name>` parses a
   markdown test-case file and enqueues Author *convert* tasks (chunks of 10).
4. **Intelligence → Test Runs → Run tests**: pick a suite, enter the staging
   **Base URL** and credential **data overrides** (`admin_phone=…` per line),
   set a cost cap, **Run**. The run executes cases across 2 parallel Playwright
   contexts; a failed case retries once (pass-on-retry = flaky).
5. Read the run: per-case **tri-state verdict**, step log, screenshots, LLM
   cost. **AMBER** cases render the offending 5xx rows / missing expected calls
   inline with a link to `/dashboard/requests`. A run with failures or any AMBER
   sends a **WhatsApp notification** via the WACRM webhook.

Smoke tests (hand-written, pre-seeded): worker
`pnpm seed:smoke --project <adminProjectId>`.

---

## 6. Analyst, quarantine & staleness (automatic)

A worker-internal scheduler runs the **Analyst** nightly (anchor hour,
configurable). It is LLM-free:

- **Flake detection** — cases that flip pass/fail across recent runs (or keep
  passing only on retry) are **quarantined**: excluded from pass/fail math,
  shown in the Test Cases **Quarantined** section with a reason. Fix and
  **Unquarantine** when stable.
- **Locator drift & cost outliers** — reported as a dated analysis Critique.
- **Staleness** — if the last 7 days of telemetry materially diverge from the
  CONFIRMED model (new screens/endpoints or shifted flows), the model flips to
  **STALE**, a hint appears on the Confirmation Gate ("re-run Scout"), and a
  WhatsApp summary is sent. Thin telemetry can't false-flip a model — a diff
  must be material.

The Analyst also runs per-run after each Truth Check (cost outliers, retry
flakes).

Gate scripts (informational): `pnpm gate:3` / `pnpm gate:4` on the worker.

---

## 7. MCP server

The worker ships an MCP server (`pnpm mcp`, stdio; `MCP_TRANSPORT=http` for
Streamable HTTP). Register for local Claude Code:

```bash
claude mcp add nirikshaka -- node <repo>/nirikshaka-worker/dist/src/mcp/server.js
```

| Tool | Does |
|---|---|
| `nirikshaka_validate` | Enqueue a run against a URL, block until the Truth Check finishes, return the tri-state verdict + top findings. |
| `nirikshaka_check_backend` | No browser: did the last N minutes of telemetry show 5xx / crashes / UI errors? |
| `nirikshaka_app_model` | Return the CONFIRMED model (or a feature slice) so Claude Code reads the app's feature map while coding. |

HTTP transport requires the `x-agent-secret` header (= `AGENT_SHARED_SECRET`).

---

## 8. Deploy checklist

The worker is **not** auto-deployed and its systemd unit is **not** installed
yet. Pradeep's manual steps:

```bash
# 1. Promote the branch (agent is permission-blocked from main).
git push origin main:main            # Vercel auto-builds the dashboard

# 2. Apply DB migrations (phase3_test_strategy + phase4_quarantine_fields).
cd nirikshaka && npx prisma migrate deploy

# 3. Worker: pull, sync schema, build (build now copies llm prompts into dist).
cd ../nirikshaka-worker && git pull && pnpm install && pnpm sync:schema && pnpm build

# 4. Playwright (one-time; needs sudo for system libs).
pnpm exec playwright install chromium
sudo pnpm exec playwright install-deps chromium

# 5. Install + start the systemd unit (one-time).
sudo cp systemd/nirikshaka-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nirikshaka-worker
#   after every later worker change: git pull && pnpm build && sudo systemctl restart nirikshaka-worker

# 6. MCP (optional, local Claude Code).
claude mcp add nirikshaka -- node $(pwd)/dist/src/mcp/server.js

# 7. Seed the pilot smoke suite (register the admin project in the dashboard first).
pnpm seed:smoke --project <adminProjectId>
```

Worker `.env` additions for Phases 2–4 (all optional, sane defaults): runner
(`RUNNER_HEADLESS`, `RUNNER_MAX_COST_USD`, `ARTIFACTS_DIR`,
`SUPABASE_ARTIFACTS_BUCKET`), MCP (`MCP_TRANSPORT`, `MCP_HTTP_PORT`), author/critic
(`AUTHOR_MAX_COST_USD`, `AUTHOR_VALIDATION_RETRIES`, `CRITIC_TEST_MAX_ITERATIONS`,
`REVIEW_TESTS_BATCH_SIZE`), analyst (`ANALYST_HOUR`, `SCHEDULER_TICK_MS`,
`FLAKE_*`, `COST_OUTLIER_*`, `DRIFT_CONFIDENCE_THRESHOLD`, `STALENESS_FLOW_SHIFT`,
`MAX_PARALLEL_CONTEXTS`, `RETRY_FAILED_CASES`), plus `WACRM_WEBHOOK_URL` +
`DASHBOARD_URL` for notifications.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Agents-offline badge / Scout never finishes | Worker down | `sudo systemctl status nirikshaka-worker`; `journalctl -u nirikshaka-worker -f` |
| Scout produced 0 features | Thin PRD, or `ANTHROPIC_API_KEY` missing on worker | Check worker logs + key |
| OpenAPI ignored | Spec was YAML | JSON only for now |
| Run fails: "playwright launch failed" | Chromium not installed on the box | `pnpm exec playwright install chromium` + `sudo … install-deps chromium` |
| Everything reads GREEN, backend clearly broke | Staging not instrumented (no telemetry for that projectId) | Instrument the target app's SDK; the Truth Check needs telemetry |
| Test Cases empty, can't generate | No CONFIRMED model | Confirm the model in App Model first |
| Model flipped to STALE unexpectedly | Real telemetry drift, or a genuinely new build | Re-run Scout, re-confirm |
| `/api/agent/*` returns 401 from scripts | Missing/mismatched `x-agent-secret` | Must equal `AGENT_SHARED_SECRET` |
| Request bodies show decryption failed | Master key changed after rows were written | Restore the original `NIRIKSHAKA_MASTER_KEY` |
| Everything 404s after a deploy | Vercel Root Directory / Framework reset | See §3 |

**Headless/API automation** (the enqueue route accepts only worker-registered
task types):

```bash
curl -X POST $DASHBOARD/api/agent/enqueue \
  -H "content-type: application/json" -H "x-agent-secret: $SECRET" \
  -d '{"type":"execute_run","projectId":"<id>","payload":{"scope":"suite","scopeRef":"smoke","baseUrl":"https://staging…","data":{"admin_phone":"+91…","admin_otp":"123456"}}}'
curl -H "x-agent-secret: $SECRET" $DASHBOARD/api/agent/runs/<taskId>
```

---

## 10. What's implemented vs deferred

**Live:** telemetry ingestion + monitoring pages · envelope encryption ·
agent task queue + worker + heartbeat/health badge · Scout (FlowMiner,
ApiChainMiner, SpecMiner, Fuse) · explain-back + targeted questions · Critic
model review with 3-iteration loop · Confirmation Gate v2 (per-feature review,
discrepancy resolution, file upload, version browser) · Playwright Runner
(locator cache, LLM recovery Haiku→Sonnet, cost caps, parallel contexts,
retry-once) · Truth Check tri-state verdicts · WACRM WhatsApp notifications ·
MCP server (3 tools) · Strategist · Author (strategy / regenerate / convert) ·
test-cases review queue · Analyst (flake/drift/cost/staleness) · internal
scheduler · quarantine flow · test-runs dashboard.

**Deferred (Phase 5):** Figma compile → locator pre-seeding; mobile driver
(Maestro/Android); cross-app multi-driver orchestration + `extract` runtime;
reverse-proxy plugin-less mode; API Composer UI; repo-ingestion miner; PDF/YAML
spec parsing; public MCP registry listing.
