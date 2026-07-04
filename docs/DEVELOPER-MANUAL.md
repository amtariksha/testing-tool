# Nirikshaka — Developer Manual

**Audience:** developers using Nirikshaka to monitor an app and build a confirmed
App Model from it. Everything user-facing happens in the **web dashboard**
(deployed on Vercel — e.g. `https://testing-tool-weld.vercel.app`); results are
reviewed there too. One background service (the **worker**) must be running for
agent features — see [§2](#2-system-topology).

**Product state:** Phase 0–1 live (telemetry + Scout + Confirmation Gate).
Phases 2–4 (test execution, truth check, test authoring, analytics) are not yet
built — see [§8](#8-whats-implemented-vs-planned).

---

## 1. What Nirikshaka does

Nirikshaka is a QA platform with two halves that feed each other:

1. **Monitoring** (live today): your app sends telemetry — API request logs,
   crashes, UI errors, and user journeys — via an SDK. The dashboard shows all
   of it in real time.
2. **Agents** (rolling out in phases): a team of agents (Scout, Critic, then
   Runner/Strategist/Author/Analyst) that *understand your app before testing
   it*. Scout mines your telemetry and product docs into an **App Model** — a
   structured map of features, screens, flows, APIs, and business rules — which
   **you confirm in the dashboard before any test is ever generated**. That
   confirmation step (the **Confirmation Gate**) is the core product rule.

---

## 2. System topology

```
Browser ──▶ Dashboard (Next.js on Vercel) ──▶ Supabase Postgres  ◀── Worker (Ubuntu box, Node 22)
                 │  /api/track/*  (SDK telemetry in)     ▲                │ claims agent tasks
                 │  /api/agent/*  (enqueue + status)     │                │ runs Scout/Critic (LLM)
                 └── dashboard pages (results out) ──────┘                └ Supabase Realtime events
```

- **Dashboard (Vercel)** — the only interface you use. Serves the UI, ingests
  telemetry, enqueues agent tasks as rows in `agent_tasks`.
- **Worker (Ubuntu, systemd)** — headless. Polls `agent_tasks`
  (`FOR UPDATE SKIP LOCKED`), runs the agents, writes results back to Postgres.
  **If the worker is down, agent tasks queue up and nothing processes them** —
  the monitoring half keeps working regardless.
- **Supabase** — single shared Postgres (source of truth) + Realtime channel
  `agent:tasks` for live agent events.

Request/response bodies in telemetry are envelope-encrypted at rest
(AES-256-GCM) and transparently decrypted when the dashboard displays them.

---

## 3. One-time setup (admin)

Skip this section if the platform is already running.

| What | Where | Notes |
|---|---|---|
| `DATABASE_URL` | Vercel env | **Must be the Supabase Session-Pooler URL** (`postgres.<ref>@aws-1-<region>.pooler.supabase.com:5432`) — Vercel is IPv4-only; the direct `db.<ref>.supabase.co` host is IPv6-only and will not connect. Percent-encode special chars in the password (`#` → `%23`). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | Auth + realtime in the browser. |
| `NIRIKSHAKA_MASTER_KEY` | Vercel env + worker `.env` | 32-byte hex (`openssl rand -hex 32`). Same value both sides. |
| `AGENT_SHARED_SECRET` | Vercel env + worker `.env` | Auth for headless calls to `/api/agent/*`. Same value both sides. |
| Root Directory = `nirikshaka`, Framework = **Next.js** | Vercel project settings | Monorepo — both settings required or the deploy serves 404s. |
| Deployment Protection = *Only Preview Deployments* | Vercel project settings | Otherwise SDKs and users are blocked by Vercel SSO. |
| Worker service | Ubuntu box | `cd nirikshaka-worker && pnpm install && pnpm build`, then install `systemd/nirikshaka-worker.service`. Worker `.env` needs `DATABASE_URL` (direct host is fine here), `ANTHROPIC_API_KEY`, master key, shared secret, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. |
| DB migrations | `nirikshaka/` | `npx prisma migrate deploy` (history already baselined). |

Deploys: push to `main` → Vercel builds the dashboard automatically. The worker
is **not** auto-deployed — `git pull && pnpm build && sudo systemctl restart nirikshaka-worker`.

---

## 4. Workflow step 1 — register and create a project

1. Open the dashboard URL → **Register** (email + password via Supabase auth).
2. **Projects → New Project**: name, platform (`WEB`, `ANDROID`, `IOS`,
   `FLUTTER`, `REACT_NATIVE`), environment.
3. Open the project → **API Keys** → copy the key (`x-api-key` for all SDK
   traffic).

Each app you monitor is its own project (e.g. CommunityOS = three projects:
resident Flutter app, guard app, admin web).

---

## 5. Workflow step 2 — instrument your app

**Web:** the dashboard's **SDKs** page has the snippet. The web SDK
(`src/lib/sdk/web.ts`) auto-captures `fetch`/XHR, crashes, UI errors, and
journeys after `init({ apiKey, endpoint })`.

**Flutter:** use `nirikshaka_plugin` (in this repo). Wire `dio_interceptor`
(HTTP capture), `navigator_observer` (screen views), `journey_tracker`
(sessions) with your API key.

Verify in the dashboard within seconds: **API Monitoring** (live requests),
**Journeys** (sessions + event timeline), **Crashes**, **UI Errors**. The
LIVE badge = realtime connected.

Telemetry is not just monitoring — it is **Scout's raw material**. The more
real usage flows through, the better the mined App Model.

---

## 6. Workflow step 3 — build and confirm the App Model

Dashboard → **Intelligence → App Model** (Confirmation Gate).

1. Select the project.
2. **Run Scout**: paste your PRD / feature doc (markdown or plain text) and
   optionally an **OpenAPI spec (JSON only)**. Click *Run Scout*. This enqueues
   a `fuse_model` task; the worker then:
   - mines telemetry: screen-flow graph (`FlowMiner`) + API call chains
     (`ApiChainMiner`) — empty until your app is instrumented, that's fine;
   - mines the docs with an LLM (`SpecMiner`) into features/roles/entities;
   - **fuses** everything into one model with per-claim confidence + evidence,
     flagging spec-vs-telemetry conflicts as **discrepancies**;
   - auto-enqueues a **Critic** review → verdict + findings, status `IN_REVIEW`.
3. Refresh after ~30–60 s (no auto-refresh yet — see §7 gaps). Review:
   - **Feature cards** with confidence bars — expand for roles, screens, APIs,
     states, business rules, and **evidence links** (which doc/telemetry claim
     supports each feature);
   - **Critic verdict** (`approved` / `needs_human` / `rejected`) + findings;
   - **Discrepancy inbox** — spec says X, telemetry shows Y;
   - **Coverage boundaries** — low-confidence features are routed to
     `needs_human` and won't be auto-tested.
4. Decide:
   - **Confirm model** → status `CONFIRMED`. This is the gate: only confirmed
     models can ever feed test generation (Phase 3 agents refuse otherwise).
   - **Reject → re-mine** → back to `DRAFT`; fix your docs and run Scout again
     (creates version N+1; history is kept in the DB).

Cost: one Scout+Critic run on a medium PRD ≈ **$0.05–0.15** of LLM usage.

**Live agent events:** the dashboard subscribes to the `agent:tasks` channel;
open the browser console to see `[nirikshaka:agent] task_claimed/task_done`
events as the worker processes your run.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Ran Scout, nothing appears after minutes | Worker down (tasks queue forever; no UI indicator yet) | `sudo systemctl status nirikshaka-worker` on the box; check `journalctl -u nirikshaka-worker -f` |
| Scout produced a model with 0 features | Empty/too-thin PRD text, or LLM key missing on worker | Check worker logs; verify `ANTHROPIC_API_KEY` in worker `.env` |
| OpenAPI ignored | Spec was YAML | JSON only for now — convert first |
| Telemetry pages empty | SDK key wrong / project suspended / quota hit | Check API key status and project quota in Settings |
| Request bodies show `[nirikshaka] decryption failed` | Master key changed after rows were written | Restore the original `NIRIKSHAKA_MASTER_KEY` |
| Everything 404s after a deploy | Vercel Root Directory / Framework Preset reset | See §3 table |
| `/api/agent/*` returns 401 from scripts | Missing/mismatched `x-agent-secret` header | Must equal `AGENT_SHARED_SECRET` |

**Headless/API automation** (CI, scripts):

```bash
# enqueue a Scout run
curl -X POST $DASHBOARD/api/agent/enqueue \
  -H "content-type: application/json" -H "x-agent-secret: $SECRET" \
  -d '{"type":"fuse_model","projectId":"<id>","payload":{"sources":[{"type":"prd","content":"..."}]}}'
# poll status
curl -H "x-agent-secret: $SECRET" $DASHBOARD/api/agent/runs/<taskId>
```

---

## 8. What's implemented vs planned

**Live today:** telemetry ingestion + all monitoring pages · envelope
encryption at rest · agent task queue + worker · Scout (FlowMiner,
ApiChainMiner, SpecMiner, Fuse) · Critic model review · Confirmation Gate UI ·
realtime agent events.

**Not yet built (by phase, per the implementation doc):**

| Phase | Missing | Impact on you |
|---|---|---|
| 2 | Runner (Playwright), YAML test schema/storage, **Truth Check** (GREEN/AMBER/RED verdicts), test-runs dashboard page, WhatsApp notifications, MCP server | No tests can be executed yet — the workflow currently ends at a CONFIRMED model |
| 3 | Strategist (test strategy) + Author (test generation) | Confirmed models don't generate tests yet |
| 4 | Analyst (flake/cost/staleness detection), parallel execution, quarantine | — |
| 5 | Figma ingestion, mobile driver (Maestro), plugin-less proxy mode, PDF/YAML spec parsing | PRD must be pasted as text; OpenAPI as JSON |

**Known gaps in the current UI workflow** (missing links — candidates for the
next work session):

1. **No task progress in the UI** — after *Run Scout* you must refresh manually;
   task failures (`agent_tasks.error`) are never displayed anywhere.
2. **No worker-health indicator** — heartbeats are written to
   `agent_heartbeats` but nothing reads them; a dead worker looks identical to
   a slow one.
3. **Enqueue accepts 12 task types, worker handles 3** (`noop`, `fuse_model`,
   `review_model`) — enqueueing e.g. `mine_telemetry` queues it forever.
4. **Confirmation Gate is model-level only** — per-feature approve/edit/reject,
   discrepancy *resolution* actions, the "explain it back" panel, and Scout's
   targeted-questions loop (doc §4.3) are not implemented.
5. **Critic loop is single-pass** — no generator-verifier iteration (max-3 then
   `needs_human`) yet; a `rejected` model just returns to DRAFT and waits for
   you to re-run Scout manually.
6. **No file upload** for specs (paste-only), no model version browser
   (latest only), agent event logger is console-only.
