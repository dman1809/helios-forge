# Helios Forge Proof Console Design

**Date:** 2026-08-29
**Status:** Approved in chat; written-spec review pending
**Scope:** Helios visual redesign, judge-facing proof, operator controls, mission registry, and review hardening

## Purpose

Helios Forge must make parallel agent work understandable in a five-minute live demo without becoming a crowded dashboard. The redesign keeps the existing two-lane competition and evidence inspector, gives the product the Helios charcoal-and-silver identity, makes the winner decision mechanically legible, adds useful operator controls, and supports a second deterministic mission through the same orchestration path.

The console remains an operational first screen. It does not become a landing page, marketing hero, or generic agent chat interface.

## Success Criteria

1. The transparent Helios wordmark is the first brand signal and sits seamlessly on a charcoal background.
2. Silver is the primary accent. Green and red remain reserved for pass and fail semantics.
3. The judge decision explains score, changed-line count, tie-break reason, and elapsed time without opening a secondary screen.
4. A user can export a content-light run-evidence JSON file locally.
5. Trace evidence can be filtered by All, North, South, and Judge without losing events.
6. Repair completion is confirmed by the server-side Codex turn lifecycle, not inferred from a client-side event count.
7. The existing Incident Dispatch mission and a new Retry Budget mission use the same mission registry, service, API, reducer, and UI.
8. Replay never presents a post-repair patch during the pre-repair failed state.
9. Desktop and 375-pixel mobile layouts have no overlap or unintended horizontal overflow.
10. Existing live/replay provenance remains explicit, all tests and builds pass, and every live Devbox is shut down after capture.

## Non-Goals

- No user accounts, persistence service, database, analytics, billing, or deployment system.
- No free-form mission authoring in the browser.
- No new dependency except assets already owned by Helios.
- No public repository, push, PR, merge, or external publication in this increment.
- No automatic live Runloop loop. The operator continues to advance judge, repair, and verify deliberately.

## Visual System

### Palette

- Canvas: `#0b0b0c`
- Top bar: `#0e0f10`
- Primary surface: `#121315`
- Raised surface: `#17181b`
- Hairline border: `#2a2c30`
- Strong silver border: `#5e6167`
- Primary text: `#eceef0`
- Secondary text: `#9da1a7`
- Muted text: `#686c72`
- Silver accent: `#c7c9cd`
- Pass: `#66d39a`
- Fail: `#f07873`

There are no gradients, decorative glows, color blobs, or tinted candidate themes. North and South use different steel intensities and labels, while selection uses a brighter silver border and a compact selected marker.

### Logo and Header

Copy the existing transparent asset
`Operations/Website/Cloudflare/site/assets/helios-logo-v2.png` into the app's public assets. Do not modify the source asset. The desktop header displays the complete transparent wordmark at a constrained width, followed by a hairline divider and the product label `FORGE / MISSION CONTROL`. Mobile displays the same asset at a smaller width; it must not be replaced by a text-only monogram.

The header retains mode, provenance, phase, connection state, primary action, reset, and shutdown. Controls stay compact and use familiar Lucide icons with tooltips where the icon alone is not self-evident.

### Layout

The existing vertical order remains:

1. Header
2. Mission strip and selector
3. Verification rail and decision summary
4. Candidate lanes
5. Evidence inspector

Candidate lanes and the evidence inspector remain peers. No card is nested inside another card. Metric groups are unframed rows separated by hairlines.

## Functional Design

### Mission Registry

Replace the singleton mission constant with a typed registry keyed by `ForgeMissionId`. Each mission owns:

- public metadata: ID, number, title, brief, and short category;
- target and judge roots;
- target and judge files;
- candidate prompts;
- seed launch commands;
- judge and visible-test commands;
- artifact diff paths and primary source path.

`ForgeService.start(missionId)` validates the ID, stores the selected mission on the live run, and uses it for judge, repair, verify, and artifact capture. Later endpoints derive mission identity only from the stored run; clients cannot switch a live run's mission midstream.

The start response and client state carry `missionId`. Resetting or changing mission clears the current replay state. Mission selection is disabled while a live run exists.

### Mission 01: Incident Dispatch Regression

Preserve the current mission and its proven six-check judge. Preserve the genuine live replay captured from run `7791fa62-d60`, but split its artifacts chronologically:

- the failed state shows the genuine 5/6 pre-repair patch shape, without duplicate-ID handling;
- repair completion replaces it with the final `Set`-based patch;
- verification then records 6/6.

### Mission 02: Retry Budget Regression

Add a small JavaScript repository centered on `allocateRetries(requests, budget)`. The contract is:

- completed and permanently failed requests are excluded;
- urgent requests precede normal, then low priority;
- fewer prior attempts win within a priority;
- exact ties preserve input order;
- the caller's array is never mutated;
- duplicate IDs collapse to the first eligible occurrence;
- selected retry cost never exceeds the total budget, while an over-budget request does not prevent a later affordable request from being selected.

Visible tests cover priority and basic eligibility. The deterministic external judge covers all invariants. The seed contains a plausible budget-allocation regression so visible tests pass after an ordinary repair while at least one hidden production invariant can drive the evidence-only repair turn.

Before final delivery, run one live Retry Budget competition and capture a genuine replay if Runloop is healthy. If that capture cannot be completed, keep Mission 02 available in Live mode but disable its Replay action with a clear `No recording` state. Never label synthetic evidence as a recorded replay.

### Decision Record

Extend judge output with a content-light `ForgeDecision` computed on the server:

- selected candidate;
- each candidate's passed and total checks;
- each candidate's changed-line count;
- the first tie-break field that decided the winner;
- judge completion timestamp and elapsed milliseconds from run start.

The server remains authoritative. The client renders a compact decision row under the verdict rail after selection. It does not recompute the winner independently.

### Evidence Export

A pure client helper builds a versioned JSON report from serializable run state and decision data. The report includes mission metadata, provenance, run/resource IDs, scores, decision reason, check results, event summaries, and final diff. It excludes raw credentials, environment values, browser state, hidden-judge source, and unbounded protocol frames.

A Download icon in the evidence header creates the file with a deterministic name. Export is disabled until a run has evidence.

### Operator Controls

The evidence trace gains a compact filter control with All, N, S, and Judge. Filtering changes only the rendered list. The reducer always retains the full event history.

The header displays the actual WebSocket state as `Connected`, `Reconnecting`, or `Offline`. This indicator describes the browser event stream only; it does not claim that a Devbox is healthy.

### Repair Completion Contract

Add a narrow `sendAndWaitForTurnCompletion` operation to `CodexConnectionManager`:

1. Register a one-shot waiter before sending the repair prompt.
2. Resolve only on the next matching `turn/completed` event.
3. Reject on disconnect, shutdown, or a bounded timeout.
4. Always remove the waiter after resolve or reject.

`ForgeService.repair` awaits that operation before returning. The client dispatches `repair_completed` from the successful HTTP response and removes the `>= 2` turn-count heuristic. A timeout produces a held error state; the UI never enables verify based on an incomplete repair.

The client retains WebSocket timeline events for display and initial candidate readiness. The theoretical pre-provision lane race remains non-gating unless a reproducible test demonstrates it.

### Phase Semantics

Add a `selected` phase. A failing `candidate_selected` action moves the run from `judging` to `selected`; the header label becomes `Winner selected`. Repair moves it to `repairing`, repair completion to `repaired`, and successful verification to `verified`.

## API Changes

- `POST /api/forge/start` accepts `{ missionId }` and returns the validated mission ID with candidate IDs.
- `POST /api/forge/judge` returns results, artifacts, and the server decision record.
- `POST /api/forge/repair` returns only after the selected repair turn completes or fails closed.
- Existing verify, artifacts, and shutdown routes retain their paths and derive mission behavior from the stored run.

Malformed or unknown mission IDs return a client error. Unknown run IDs continue to return 404. A live run cannot change mission after provisioning.

## Error Handling

- Mission validation, judge parsing, repair waiting, and report generation fail closed.
- Partial candidate provisioning shuts down every manager created by that start attempt.
- Failed live actions preserve visible error evidence and do not silently fall back to replay.
- Replay unavailability for a mission is explicit and does not fabricate evidence.
- Evidence export failure remains local and does not alter run state.

## Test Strategy

### Pure tests

- Mission registry lookup, validation, seed isolation, and both mission fixtures.
- Winner metrics and first-effective tie-break reason.
- Run-report generation and content-light exclusions.
- Reducer mission identity, selected phase, artifact chronology, and verification state.
- Repair waiter resolve, timeout, disconnect, and cleanup behavior.

### Integration tests

- Mission-aware start options and artifact commands.
- Repair endpoint completes only after the selected turn completes.
- Unknown mission and run failures.
- Existing Incident Dispatch contracts remain green.

### Browser verification

- Desktop and 375-pixel mobile screenshots.
- Logo alpha blends with charcoal without a rectangular background.
- Both mission selectors and all replay states.
- Decision row, evidence export, trace filters, connection-state transitions, reset, and shutdown.
- No overlap, blank primary region, or unintended horizontal overflow.

### Final gate

Run tests, typecheck, production build, `git diff --check`, HTTP 200, and empty agent-registry checks. If a live Mission 02 capture runs, confirm every Devbox is shut down afterward.

## Delivery Posture

All work remains local on `forge-mvp`. The existing dev server stays available at `http://localhost:5176`. No commit beyond design documentation, push, PR, merge, external message, or publication occurs without a separate integration decision.
