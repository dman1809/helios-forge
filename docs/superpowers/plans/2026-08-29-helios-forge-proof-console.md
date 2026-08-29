# Helios Forge Proof Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Helios Forge in the charcoal-and-silver Helios identity while adding judge-facing decision proof, operator controls, robust repair completion, and a second deterministic mission.

**Architecture:** Replace the singleton mission with a typed registry whose selected mission is stored on each live run. Keep winner selection, decision metrics, repair completion, and mission-aware artifact capture authoritative on the server; keep trace filtering and evidence export as pure client concerns. Preserve the existing reducer/view-model path for both live and replay, with chronological artifact replacement.

**Tech Stack:** TypeScript, React 19, Express 5, Bun 1.2.21 tests, Vite 8, Runloop API client, Runloop remote-agents SDK, Codex app-server, Lucide React, vanilla CSS, Superdesign.

**Spec:** `docs/superpowers/specs/2026-08-29-helios-forge-proof-console-design.md`

## Global Constraints

- Canvas `#0b0b0c`; silver is the primary accent; green and red are reserved for pass and fail.
- Use the real transparent `helios-logo-v2.png`; no initials, generated mark, SVG substitute, or text-only replacement.
- No gradients, decorative glows, floating decoration, nested cards, or tinted candidate themes.
- No new runtime dependency or dependency bump.
- Replay must never present post-repair code during the failed pre-repair state.
- Unknown missions, malformed judge output, repair timeout, and partial provisioning fail closed.
- Never serialize credentials, environment values, hidden-judge source, or browser storage.
- No fresh live Runloop run until all pure tests, typecheck, build, and replay browser checks are green.
- Shut down every live Devbox after capture and verify `/api/agents` is empty.
- Work only on local branch `forge-mvp`; no push, PR, merge, publication, or external message.

---

### Task 1: Preserve the Proven MVP and Establish Superdesign Context

**Files:**
- Commit existing: `examples/combined-app/**`, `bun.lock`, `docs/superpowers/plans/2026-08-29-helios-forge-mvp.md`
- Create: `.superdesign/init/components.md`
- Create: `.superdesign/init/layouts.md`
- Create: `.superdesign/init/routes.md`
- Create: `.superdesign/init/theme.md`
- Create: `.superdesign/init/pages.md`
- Create: `.superdesign/init/extractable-components.md`
- Copy: `examples/combined-app/public/helios-logo.png`

**Interfaces:**
- Consumes: the verified 13-test MVP and source asset `Operations/Website/Cloudflare/site/assets/helios-logo-v2.png`.
- Produces: a reversible local MVP commit, complete Superdesign discovery context, and a repo-local transparent logo asset.

- [ ] **Step 1: Re-run the existing gate before checkpointing**

Run from `examples/combined-app`:

```powershell
& 'C:\LLM\tools\bun-v1.2.21\bun-windows-x64\bun.exe' run test
& 'C:\LLM\tools\bun-v1.2.21\bun-windows-x64\bun.exe' run typecheck
& 'C:\LLM\tools\bun-v1.2.21\bun-windows-x64\bun.exe' run build
```

Expected: 13 tests pass; typecheck and build exit 0.

- [ ] **Step 2: Commit only the proven MVP files**

```powershell
git add -- bun.lock examples/combined-app docs/superpowers/plans/2026-08-29-helios-forge-mvp.md
git diff --cached --check
git commit -m "feat(examples): add Helios Forge mission control"
```

Expected: the design-spec commit remains its own prior commit; no orientation or credential file is staged.

- [ ] **Step 3: Build the six Superdesign init files from the real render branch**

Read `ForgeApp.tsx`, `ForgeApp.css`, `main.tsx`, and their local imports. Write all six non-empty files under `.superdesign/init/`, including full UI source where required by the Superdesign init contract. Do not create `.superdesign/resume.json` during init.

- [ ] **Step 4: Upload the real logo as a Superdesign brand asset and create one redesign draft**

Run the CLI help before constructing each command:

```powershell
npx --yes @superdesign/cli@latest
npx --yes @superdesign/cli@latest list-models
npx --yes @superdesign/cli@latest upload-asset --help
npx --yes @superdesign/cli@latest create-design-draft --help
```

Select a design-capable model from the live catalog. Upload the source logo with purpose `brand`, stable key `helios-wordmark`, and description `Transparent silver Helios Strategic Innovations wordmark`. Reproduce the existing page from full `ForgeApp.tsx` and `ForgeApp.css` context, then create the approved charcoal-and-silver replacement direction using the uploaded asset reference. Do not substitute the logo.

- [ ] **Step 5: Copy and verify the logo asset**

Copy the source bytes to `examples/combined-app/public/helios-logo.png`. Verify SHA-256 equality and confirm the corner alpha is zero. Do not re-encode the PNG.

- [ ] **Step 6: Commit design context and asset**

```powershell
git add -- .superdesign/init examples/combined-app/public/helios-logo.png
git diff --cached --check
git commit -m "chore(examples): add Helios Forge design context"
```

---

### Task 2: Add the Typed Mission Registry and Retry Budget Fixture

**Files:**
- Create: `examples/combined-app/src/shared/missions/mission-types.ts`
- Create: `examples/combined-app/src/shared/missions/incident-dispatch.ts`
- Create: `examples/combined-app/src/shared/missions/retry-budget.ts`
- Create: `examples/combined-app/src/shared/forge-missions.ts`
- Modify: `examples/combined-app/src/shared/forge-mission.test.ts`
- Remove after imports migrate: `examples/combined-app/src/shared/forge-mission.ts`

**Interfaces:**
- Produces: `ForgeMissionId = "incident-dispatch-v1" | "retry-budget-v1"`, `ForgeMission`, `FORGE_MISSIONS`, `getForgeMission(id)`, and `buildSeedLaunchCommands(mission)`.
- `ForgeMission` includes `artifactPaths: string[]`, `sourcePath: string`, `testCommand: string`, and existing mission metadata/files/candidates.

- [ ] **Step 1: Write failing registry and Retry Budget tests**

Add assertions equivalent to:

```ts
expect(Object.keys(FORGE_MISSIONS)).toEqual([
  "incident-dispatch-v1",
  "retry-budget-v1",
]);
expect(() => getForgeMission("unknown" as ForgeMissionId)).toThrow("Unknown Forge mission");
expect(getForgeMission("retry-budget-v1").judgeFiles["judge.mjs"]).toContain(
  'check("budget"',
);
expect(getForgeMission("retry-budget-v1").artifactPaths).toEqual([
  "src/allocate-retries.mjs",
  "test/allocate-retries.test.mjs",
]);
```

- [ ] **Step 2: Run the focused test and confirm RED**

```powershell
& 'C:\LLM\tools\bun-v1.2.21\bun-windows-x64\bun.exe' test src/shared/forge-mission.test.ts
```

Expected: module/type exports do not exist.

- [ ] **Step 3: Implement mission types and move Incident Dispatch unchanged**

Define the registry contract:

```ts
export type ForgeMissionId = "incident-dispatch-v1" | "retry-budget-v1";

export interface ForgeMission {
  id: ForgeMissionId;
  number: string;
  title: string;
  brief: string;
  category: string;
  targetRoot: string;
  judgeRoot: string;
  targetFiles: Record<string, string>;
  judgeFiles: Record<string, string>;
  judgeCommand: string;
  testCommand: string;
  artifactPaths: string[];
  sourcePath: string;
  candidates: ReadonlyArray<{
    id: "north" | "south";
    label: string;
    strategy: string;
    prompt: string;
  }>;
}
```

Move the current fixture byte-for-byte except for registry metadata and artifact fields.

- [ ] **Step 4: Implement Retry Budget target and six-plus-check judge**

The target exports `allocateRetries(requests, budget)`. Visible tests cover eligibility and priority. The hidden judge must assert priority, budget ceiling, scanning past an unaffordable request, immutability, stable ties, and first-eligible duplicate-ID retention. Emit the same `FORGE_JUDGE_RESULT=` marker and exit 1 on any failure.

- [ ] **Step 5: Run both fixtures locally**

The focused Bun test must execute visible and hidden suites in temporary directories for both missions. Expected: visible suite exit 0; seeded hidden judge exit 1 with a valid marker and at least six checks.

- [ ] **Step 6: Commit the mission registry**

```powershell
git add -- examples/combined-app/src/shared/missions examples/combined-app/src/shared/forge-missions.ts examples/combined-app/src/shared/forge-mission.ts examples/combined-app/src/shared/forge-mission.test.ts
git diff --cached --check
git commit -m "feat(examples): add Forge mission registry"
```

---

### Task 3: Add Mission-Aware State, Decision Metrics, and Evidence Reports

**Files:**
- Modify: `examples/combined-app/src/shared/forge-types.ts`
- Modify: `examples/combined-app/src/client/forge-state.ts`
- Modify: `examples/combined-app/src/client/forge-state.test.ts`
- Create: `examples/combined-app/src/shared/forge-decision.ts`
- Create: `examples/combined-app/src/shared/forge-decision.test.ts`
- Create: `examples/combined-app/src/client/forge-report.ts`
- Create: `examples/combined-app/src/client/forge-report.test.ts`

**Interfaces:**
- Produces: `ForgeDecision`, mission-aware `ForgeRunState`, `computeForgeDecision(...)`, `buildForgeRunReport(state)`, and `downloadForgeRunReport(state)`.
- `ForgePhase` gains `selected`; `ForgeRunState` gains `missionId` and `decision`.

- [ ] **Step 1: Write failing state, decision, and report tests**

Test these exact behaviors:

```ts
expect(createInitialForgeState("replay", "retry-budget-v1").missionId)
  .toBe("retry-budget-v1");
expect(selectedFailure.phase).toBe("selected");
expect(decision.decidedBy).toBe("changed-lines");
expect(report.schemaVersion).toBe(1);
expect(JSON.stringify(report)).not.toContain("FORGE_JUDGE_RESULT=");
expect(JSON.stringify(report)).not.toContain("CODEX_AUTH_JSON");
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run the three test files with pinned Bun. Expected: missing signatures and phase.

- [ ] **Step 3: Implement authoritative decision metrics**

Define:

```ts
export interface ForgeDecision {
  selectedCandidateId: ForgeCandidateId;
  decidedBy: "passed-checks" | "exit-code" | "changed-lines" | "candidate-id";
  changedLines: Record<ForgeCandidateId, number>;
  elapsedMs: number;
  decidedAt: number;
}
```

`computeForgeDecision` must use the same tuple as `selectCandidate` and return the first field that differs.

- [ ] **Step 4: Implement mission-aware reducer and selected phase**

`reset` and `run_started` carry `missionId`. `decision_recorded` stores the server decision. A failing candidate selection sets `phase: "selected"`; verification remains the only path to `verified` after repair.

- [ ] **Step 5: Implement content-light report generation**

Return plain serializable data. Include bounded event summaries and check details, but reduce judge output to scores/checks and exclude `stdout`/`stderr`. `downloadForgeRunReport` uses `Blob`, `URL.createObjectURL`, a temporary anchor, and always revokes the URL.

- [ ] **Step 6: Run focused tests and commit**

```powershell
git add -- examples/combined-app/src/shared/forge-types.ts examples/combined-app/src/shared/forge-decision.ts examples/combined-app/src/shared/forge-decision.test.ts examples/combined-app/src/client/forge-state.ts examples/combined-app/src/client/forge-state.test.ts examples/combined-app/src/client/forge-report.ts examples/combined-app/src/client/forge-report.test.ts
git diff --cached --check
git commit -m "feat(examples): add Forge decision evidence"
```

---

### Task 4: Make Live Orchestration Mission-Aware and Repair Completion Authoritative

**Files:**
- Modify: `examples/combined-app/src/server/codex-manager.ts`
- Modify: `examples/combined-app/src/server/forge-service.ts`
- Modify: `examples/combined-app/src/server/forge-service.test.ts`
- Modify: `examples/combined-app/src/server/routes/forge.ts`

**Interfaces:**
- Consumes: mission registry and `computeForgeDecision`.
- Produces: `CodexConnectionManager.sendAndWaitForTurnCompletion(prompt, timeoutMs)`, `ForgeService.start(missionId)`, and judge responses with `decision`.

- [ ] **Step 1: Write failing service and lifecycle tests**

Add tests that assert:

```ts
expect(buildCandidateStartOptions("north", retryMission).workingDir)
  .toBe(retryMission.targetRoot);
expect(buildRepairPrompt("north", result, retryMission))
  .toContain(retryMission.targetRoot);
expect(await repairPromise).toEqual({ candidateId: "north", ok: true });
```

The repair test uses a fake manager whose waiter does not resolve until a synthetic `turn/completed` signal. Add timeout and shutdown rejection tests at the narrow manager helper boundary.

- [ ] **Step 2: Run focused server tests and confirm RED**

Expected: mission parameters and waiter method are missing.

- [ ] **Step 3: Implement the one-shot turn waiter**

Register the waiter before `send()`. Resolve on the next `turn/completed` timeline event. Reject and delete it on timeout, disconnect, or shutdown. Use a bounded default of 300,000 ms and do not expose raw protocol frames.

- [ ] **Step 4: Store mission and timing on each live run**

Extend `LiveRun` with `mission` and `startedAt`. Validate `missionId` in `start`. Use the stored mission for candidate prompts, judge command, repair prompt, artifact paths, source path, and visible-test command.

- [ ] **Step 5: Return the server decision and await repair completion**

`judge` calls `computeForgeDecision(results, artifacts, startedAt, Date.now())`. `repair` calls `sendAndWaitForTurnCompletion` and returns only after completion. Unknown missions return 400; timeout returns a held error response.

- [ ] **Step 6: Correct the route contract**

Read `missionId` from `req.body` in `/api/forge/start`; do not accept a mission override on judge, repair, verify, artifacts, or shutdown.

- [ ] **Step 7: Run service tests, typecheck, and commit**

```powershell
git add -- examples/combined-app/src/server/codex-manager.ts examples/combined-app/src/server/forge-service.ts examples/combined-app/src/server/forge-service.test.ts examples/combined-app/src/server/routes/forge.ts
git diff --cached --check
git commit -m "feat(examples): harden Forge live orchestration"
```

---

### Task 5: Correct Replay Chronology and Client Lifecycle

**Files:**
- Replace: `examples/combined-app/src/client/forge-replay.ts`
- Modify: `examples/combined-app/src/client/use-forge-run.ts`
- Create: `examples/combined-app/src/client/forge-replay.test.ts`

**Interfaces:**
- Produces: `FORGE_REPLAYS: Partial<Record<ForgeMissionId, ForgeReplayStep[]>>`, `playReplay(missionId)`, WebSocket status, and server-confirmed repair completion.

- [ ] **Step 1: Write failing chronology tests**

Reduce the Incident replay one step at a time and assert:

```ts
expect(stateAfterSelection.verdict).toBe("failed");
expect(stateAfterSelection.candidates.north.artifact?.source)
  .not.toContain("seenIds");
expect(stateAfterRepair.candidates.north.artifact?.source)
  .toContain("seenIds");
expect(finalState.verdict).toBe("verified");
```

Also assert that a missing replay returns unavailable rather than falling back to another mission.

- [ ] **Step 2: Run focused replay tests and confirm RED**

Expected: the failed state contains the final artifact and registry does not exist.

- [ ] **Step 3: Split pre-repair and final artifacts**

Record the 5/6 North patch before `repair_started`, then dispatch a second `artifact_recorded` action after `repair_completed` with the final `Set`-based source/diff. Keep the genuine run/resource IDs and six judge checks.

- [ ] **Step 4: Make the hook mission-aware**

Expose `missionId`, `setMission`, and `replayAvailable`. Start sends `{ missionId }`. Mode or mission changes clear timers and state. The server judge response dispatches `decision_recorded`.

- [ ] **Step 5: Remove the turn-count repair heuristic**

Delete `turnCounts >= 2` repair completion. A successful `/api/forge/repair` response dispatches `repair_completed`; a rejected response moves to held error. Keep turn counts only for initial candidate readiness.

- [ ] **Step 6: Expose WebSocket connection state**

Track `connected`, `reconnecting`, or `offline`. Reconnect every 900 ms as before and resubscribe known live agents. Timeline deduplication remains keyed by agent ID and Axon sequence.

- [ ] **Step 7: Run client tests and commit**

```powershell
git add -- examples/combined-app/src/client/forge-replay.ts examples/combined-app/src/client/forge-replay.test.ts examples/combined-app/src/client/use-forge-run.ts
git diff --cached --check
git commit -m "fix(examples): preserve Forge replay chronology"
```

---

### Task 6: Implement the Helios Visual System and Operator UI

**Files:**
- Modify: `examples/combined-app/src/client/ForgeApp.tsx`
- Replace: `examples/combined-app/src/client/ForgeApp.css`
- Modify: `examples/combined-app/index.html`

**Interfaces:**
- Consumes: mission registry, `ForgeDecision`, report download helper, trace events, connection state, and replay availability.
- Produces: branded console, mission selector, decision row, trace filters, evidence export, and responsive states.

- [ ] **Step 1: Replace the temporary monogram with the transparent wordmark**

Render:

```tsx
<img
  className="helios-wordmark"
  src="/helios-logo.png"
  alt="Helios Strategic Innovations"
/>
<span className="brand-divider" />
<div className="product-label"><strong>FORGE</strong><span>MISSION CONTROL</span></div>
```

Use explicit width/height constraints to prevent header shift.

- [ ] **Step 2: Add mission and connection controls**

Use a native styled `select` or accessible menu for the two missions. Disable it while a live run exists. Render a compact status dot with `Connected`, `Reconnecting`, or `Offline`; do not call it Devbox health.

- [ ] **Step 3: Add the decision row**

After judge selection, show selected candidate, both scores, both changed-line counts, first deciding field, and elapsed time in one unframed hairline-separated band.

- [ ] **Step 4: Add trace filtering and evidence export**

Use four compact filter buttons: All, N, S, Judge. Filter only the rendered list. Add a Lucide Download icon with tooltip `Download evidence JSON`; disable it until judge evidence exists.

- [ ] **Step 5: Apply charcoal and silver styling**

Replace amber/cyan brand and lane colors with the exact spec tokens. Retain only semantic pass green and fail red. Keep cards at 6px radius, avoid gradients and shadows, and preserve fixed candidate/evidence dimensions.

- [ ] **Step 6: Verify responsive behavior in the running browser**

Check desktop and a 375-pixel viewport. Assert no element extends beyond the document width, all header controls remain reachable, candidate cards stack, and the logo is visible without a rectangular background.

- [ ] **Step 7: Commit the UI**

```powershell
git add -- examples/combined-app/src/client/ForgeApp.tsx examples/combined-app/src/client/ForgeApp.css examples/combined-app/index.html
git diff --cached --check
git commit -m "feat(examples): redesign Helios Forge proof console"
```

---

### Task 7: Capture and Bind the Retry Budget Replay

**Files:**
- Modify after live proof: `examples/combined-app/src/client/forge-replay.ts`
- Modify if evidence changes: `examples/combined-app/src/client/forge-replay.test.ts`

**Interfaces:**
- Consumes: fully green live Mission 02 path.
- Produces: genuine `retry-budget-v1` replay or an explicit unavailable state.

- [ ] **Step 1: Run the full local gate before provisioning**

Run all tests, typecheck, build, replay browser checks, and `/api/agents`. Expected: green and agent count 0.

- [ ] **Step 2: Run one live Retry Budget competition**

Select Mission 02 in Live mode and advance launch, judge, repair, and verify manually. Capture only public-safe resource IDs, check summaries, diffs, and bounded trace events. Do not capture credentials or hidden-judge source.

- [ ] **Step 3: Require a complete verified arc**

Only create `FORGE_REPLAYS["retry-budget-v1"]` if the run reaches external-judge verification with all checks passing. If it does not, leave replay unavailable and document the reason.

- [ ] **Step 4: Shut down and verify cleanup**

Use the app shutdown control. Confirm `/api/agents` returns 0 and no active run remains in the service.

- [ ] **Step 5: Add the captured fixture test-first**

Extend replay tests to assert its initial failed result, chronological repair artifact, final pass result, mission ID, and explicit replay provenance.

- [ ] **Step 6: Commit captured public evidence**

```powershell
git add -- examples/combined-app/src/client/forge-replay.ts examples/combined-app/src/client/forge-replay.test.ts
git diff --cached --check
git commit -m "test(examples): capture Retry Budget Forge replay"
```

Skip this commit if replay remains unavailable.

---

### Task 8: Documentation, Full Verification, and Demo Handoff

**Files:**
- Modify: `examples/combined-app/docs/forge-demo.md`
- Modify: `examples/combined-app/README.md`

**Interfaces:**
- Produces: accurate two-mission runbook and final verified local demo.

- [ ] **Step 1: Correct and extend the runbook**

Change `Run external judge` to the actual `Run judge` label. Document mission selection, decision evidence, trace filters, export, connection status, Retry replay availability, and the shutdown requirement.

- [ ] **Step 2: Run exact final verification**

```powershell
& 'C:\LLM\tools\bun-v1.2.21\bun-windows-x64\bun.exe' run test
& 'C:\LLM\tools\bun-v1.2.21\bun-windows-x64\bun.exe' run typecheck
& 'C:\LLM\tools\bun-v1.2.21\bun-windows-x64\bun.exe' run build
git diff --check
git status --short
```

Expected: all tests pass, compiler/build exit 0, and no whitespace errors.

- [ ] **Step 3: Perform final browser QA**

Play every available replay at desktop and mobile widths. Capture the final verified desktop screen and the Mission 02 selection state. Confirm `REPLAY`/`LIVE`, connection status, mission, winner decision, scores, filters, export button, and logo are legible.

- [ ] **Step 4: Verify runtime and isolation state**

Confirm HTTP 200 at `http://localhost:5176`, API 200 at port 3003, `/api/agents` count 0, and ignored credential material remains ignored and untracked.

- [ ] **Step 5: Commit documentation**

```powershell
git add -- examples/combined-app/docs/forge-demo.md examples/combined-app/README.md
git diff --cached --check
git commit -m "docs(examples): document Helios Forge proof console"
```

- [ ] **Step 6: Preserve the branch for integration choice**

Do not push or merge. Report branch, final HEAD, test/build evidence, local URL, replay availability, cleanup state, and any residual risk.
