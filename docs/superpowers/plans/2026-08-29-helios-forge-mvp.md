# Helios Forge MVP Implementation Plan

> **Execution:** Implement this plan in the existing isolated `forge-mvp` branch with the executing-plans workflow. Use test-driven development for every pure behavior and verify each integration before moving on.

**Goal:** Deliver a five-minute hackathon demo in which two Codex agents work in parallel Runloop Devboxes, a deterministic harness selects the less-broken patch, a repair turn resolves the remaining regression, and Mission Control shows the full evidence trail in live or replay mode.

**Architecture:** Keep the upstream Runloop combined-app transport and agent managers. Add a Forge domain layer for mission fixtures, run state, and judge results; add server routes that provision Codex candidates and execute the judge inside their Devboxes; replace the generic client entry point with a focused operational dashboard. Replay data uses the same view model as live results and is always labeled.

**Tech Stack:** TypeScript, React 19, Express 5, Bun test, Vite 8, Runloop API client, Runloop remote-agents SDK, Codex app-server, lucide-react.

---

## Task 1: Seed the deterministic mission and judge

**Files:**
- Create: `examples/combined-app/src/shared/forge-mission.ts`
- Create: `examples/combined-app/src/shared/forge-mission.test.ts`

1. Write failing tests for the mission bundle: required files, candidate prompts, base64-safe launch commands, and public-safe labels.
2. Run `bun test src/shared/forge-mission.test.ts` from `examples/combined-app` and confirm RED.
3. Implement a tiny TypeScript incident-ranking repository as embedded files:
   - visible tests cover urgency and expired incidents;
   - hidden judge covers immutability, exact expiry boundary, stable ties, and all visible behavior;
   - the seed implementation sorts in place and keeps expired incidents.
4. Define two strategy prompts against the same task: `North` uses a minimal-diff strategy; `South` uses a policy-rewrite strategy.
5. Define the external judge command and artifact commands (`git diff`, final source, test output).
6. Re-run the focused test and confirm GREEN.

## Task 2: Build the Forge state model and replay fixture

**Files:**
- Create: `examples/combined-app/src/shared/forge-types.ts`
- Create: `examples/combined-app/src/client/forge-state.ts`
- Create: `examples/combined-app/src/client/forge-state.test.ts`
- Create: `examples/combined-app/src/client/forge-replay.ts`

1. Write failing reducer tests for `idle -> provisioning -> competing -> judging -> repairing -> verified`.
2. Test failure handling, replay/live provenance, candidate selection, and evidence preservation.
3. Run `bun test src/client/forge-state.test.ts` and confirm RED.
4. Implement serializable types and a pure reducer.
5. Add a genuine-run-shaped replay fixture with explicit `REPLAY` provenance, two candidates, one selected failing patch, one repair event, command outputs, diffs, and final verification.
6. Re-run focused tests and confirm GREEN.

## Task 3: Add Runloop orchestration APIs

**Files:**
- Modify: `examples/combined-app/src/server/codex-manager.ts`
- Modify: `examples/combined-app/src/server/agent-registry.ts`
- Create: `examples/combined-app/src/server/forge-service.ts`
- Create: `examples/combined-app/src/server/forge-service.test.ts`
- Create: `examples/combined-app/src/server/routes/forge.ts`
- Modify: `examples/combined-app/src/server/index.ts`

1. Write failing tests for candidate start configuration, score ordering, selected-candidate rules, and judge-output parsing.
2. Run `bun test src/server/forge-service.test.ts` and confirm RED.
3. Expose narrow Devbox operations on `CodexConnectionManager`: execute a command and read a file. Do not expose credentials.
4. Implement a per-process Forge service that:
   - starts `North` and `South` Codex agents in separate Runloop Devboxes;
   - seeds identical mission files with launch commands;
   - sends both prompts after their threads are ready;
   - executes the deterministic judge in both Devboxes;
   - selects the candidate with the highest pass count and smallest deterministic tie-break tuple;
   - sends the selected candidate a repair prompt containing only judge evidence;
   - reruns the judge and captures source, diff, command output, Devbox ID, Axon ID, and thread ID;
   - shuts down one run or all agents on request.
5. Register `/api/forge/start`, `/api/forge/judge`, `/api/forge/repair`, `/api/forge/verify`, `/api/forge/artifacts`, and `/api/forge/shutdown`.
6. Keep existing `/api/start` and agent routes intact for upstream compatibility.
7. Re-run focused tests and typecheck.

## Task 4: Build the Mission Control client

**Files:**
- Create: `examples/combined-app/src/client/ForgeApp.tsx`
- Create: `examples/combined-app/src/client/ForgeApp.css`
- Create: `examples/combined-app/src/client/use-forge-run.ts`
- Modify: `examples/combined-app/src/client/main.tsx`
- Modify: `examples/combined-app/package.json`

1. Add exact pinned `lucide-react` and a `test` script.
2. Build an operational first screen with:
   - compact top bar with `LIVE` or `REPLAY` badge;
   - mission brief and one primary run control;
   - two fixed candidate lanes with Devbox/Axon evidence;
   - central verdict rail showing `FAILED -> REPAIRED -> VERIFIED`;
   - tabbed evidence inspector for diff, judge output, and event trace;
   - replay reset and live shutdown controls.
3. Wire one global WebSocket to record tagged Runloop connection and Codex timeline events without exposing raw credentials.
4. Wire the live workflow controls to Forge routes and the replay control to deterministic timed state transitions.
5. Use restrained neutral surfaces with amber, cyan, red, and green semantic accents; keep cards shallow and avoid nested cards.
6. Ensure controls remain usable at desktop and mobile widths with stable dimensions and no text overlap.

## Task 5: Verify and capture the stage path

**Files:**
- Create: `examples/combined-app/docs/forge-demo.md`
- Update: `examples/combined-app/README.md`

1. Run focused tests, full combined-app tests, typecheck, and production build.
2. Run the app with the DPAPI-restored Runloop key and local Codex auth.
3. Use browser automation to verify the replay at desktop and mobile viewport sizes; capture screenshots and inspect for overflow, blank regions, and overlap.
4. Run one full live mission if time and quota permit. Save only public-safe event summaries and IDs into the replay fixture; never store credentials.
5. Confirm all Runloop Devboxes are shut down after capture.
6. Document the five-minute stage flow, honest live/replay language, known limitations, and recovery action.
7. Run `git diff --check`, inspect `git status`, and record the final verification evidence.
