import type { ForgeAction } from "./forge-state.ts";
import type { ForgeJudgeResult } from "../shared/forge-types.ts";

export interface ForgeReplayStep {
  delayMs: number;
  action: ForgeAction;
}

const northFail: ForgeJudgeResult = {
  passed: 5,
  total: 6,
  exitCode: 1,
  checks: [
    { id: "ordering", label: "severity and age ordering", passed: true, detail: "pass" },
    { id: "active-only", label: "expired incidents excluded", passed: true, detail: "pass" },
    { id: "boundary", label: "expiry boundary is exclusive", passed: true, detail: "pass" },
    { id: "immutable", label: "input array remains unchanged", passed: true, detail: "pass" },
    { id: "stable-ties", label: "exact ties preserve input order", passed: true, detail: "pass" },
    {
      id: "unique-ids",
      label: "duplicate ids collapse to the first active occurrence",
      passed: false,
      detail: "duplicate id remained in queue",
    },
  ],
  stdout: "FORGE_JUDGE_RESULT={passed:5,total:6}",
  stderr: "",
};

const southFail: ForgeJudgeResult = {
  ...northFail,
  checks: northFail.checks.map((check) => ({ ...check })),
};

const verified: ForgeJudgeResult = {
  ...northFail,
  passed: 6,
  exitCode: 0,
  checks: northFail.checks.map((check) => ({ ...check, passed: true, detail: "pass" })),
  stdout: "FORGE_JUDGE_RESULT={passed:6,total:6}",
};

const verifiedSource = `const severityWeight = {
  critical: 3,
  warning: 2,
  info: 1,
};

export function rankIncidents(incidents, now) {
  const seenIds = new Set();

  return incidents
    .filter(
      ({ id, expiresAt }) =>
        (expiresAt === null || expiresAt > now) &&
        !seenIds.has(id) &&
        seenIds.add(id),
    )
    .sort(
      (left, right) =>
        severityWeight[right.severity] - severityWeight[left.severity] ||
        left.createdAt - right.createdAt,
    );
}
`;

const verifiedDiff = `diff --git a/src/rank-incidents.mjs b/src/rank-incidents.mjs
index fba8d23..76153d8 100644
--- a/src/rank-incidents.mjs
+++ b/src/rank-incidents.mjs
@@ -4,10 +4,19 @@ const severityWeight = {
   info: 1,
 };
${" "}
-export function rankIncidents(incidents, _now) {
-  return incidents.sort(
-    (left, right) =>
-      severityWeight[right.severity] - severityWeight[left.severity] ||
-      left.createdAt - right.createdAt,
-  );
+export function rankIncidents(incidents, now) {
+  const seenIds = new Set();
+
+  return incidents
+    .filter(
+      ({ id, expiresAt }) =>
+        (expiresAt === null || expiresAt > now) &&
+        !seenIds.has(id) &&
+        seenIds.add(id),
+    )
+    .sort(
+      (left, right) =>
+        severityWeight[right.severity] - severityWeight[left.severity] ||
+        left.createdAt - right.createdAt,
+    );
 }
`;

export const FORGE_REPLAY_STEPS: ForgeReplayStep[] = [
  { delayMs: 0, action: { type: "run_started", runId: "7791fa62-d60", provenance: "replay", startedAt: 0 } },
  {
    delayMs: 350,
    action: {
      type: "candidate_provisioned",
      candidateId: "north",
      ids: {
        agentId: "c0050e96",
        devboxId: "dbx_34FlPqAFoGQhZV0DVd9bI",
        axonId: "axn_34FlPpsVpvqTB59nBWvVh",
        threadId: null,
      },
    },
  },
  {
    delayMs: 650,
    action: {
      type: "candidate_provisioned",
      candidateId: "south",
      ids: {
        agentId: "870624f0",
        devboxId: "dbx_34FlPq2wXnizHd0XvfypP",
        axonId: "axn_34FlPprpGQO5x7JyqAbs4",
        threadId: null,
      },
    },
  },
  { delayMs: 900, action: { type: "event_added", event: { id: "r1", at: 900, lane: "north", kind: "codex", label: "Patch ready", detail: "visible suite passed" } } },
  { delayMs: 1100, action: { type: "event_added", event: { id: "r2", at: 1100, lane: "south", kind: "codex", label: "Patch ready", detail: "visible suite passed" } } },
  { delayMs: 1300, action: { type: "judge_started" } },
  { delayMs: 1550, action: { type: "judge_recorded", candidateId: "north", result: northFail } },
  { delayMs: 1700, action: { type: "judge_recorded", candidateId: "south", result: southFail } },
  { delayMs: 1850, action: { type: "candidate_selected", candidateId: "north" } },
  {
    delayMs: 2100,
    action: {
      type: "artifact_recorded",
      candidateId: "north",
      artifact: {
        diff: verifiedDiff,
        source: verifiedSource,
        testOutput: "# tests 2\n# pass 2\n# fail 0",
      },
    },
  },
  { delayMs: 2250, action: { type: "repair_started", candidateId: "north" } },
  { delayMs: 2800, action: { type: "repair_completed", candidateId: "north" } },
  { delayMs: 3050, action: { type: "verification_recorded", candidateId: "north", result: verified } },
  { delayMs: 3200, action: { type: "event_added", event: { id: "r3", at: 3200, lane: "judge", kind: "verdict", label: "Verified", detail: "6 / 6 deterministic checks" } } },
];
