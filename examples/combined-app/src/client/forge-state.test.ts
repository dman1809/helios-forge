import { describe, expect, test } from "bun:test";
import {
  createInitialForgeState,
  forgeReducer,
  type ForgeAction,
} from "./forge-state.ts";
import type { ForgeJudgeResult } from "../shared/forge-types.ts";

const failingJudge: ForgeJudgeResult = {
  passed: 4,
  total: 5,
  exitCode: 1,
  checks: [
    { id: "immutable", label: "input array remains unchanged", passed: false, detail: "input array was mutated" },
  ],
  stdout: "FORGE_JUDGE_RESULT={...}",
  stderr: "",
};

const passingJudge: ForgeJudgeResult = {
  passed: 5,
  total: 5,
  exitCode: 0,
  checks: [],
  stdout: "FORGE_JUDGE_RESULT={...}",
  stderr: "",
};

function reduce(actions: ForgeAction[]) {
  return actions.reduce(forgeReducer, createInitialForgeState("replay"));
}

describe("Forge run state", () => {
  test("moves through the complete failed, repaired, verified path", () => {
    const state = reduce([
      { type: "run_started", runId: "run-1", provenance: "replay", startedAt: 100 },
      {
        type: "candidate_provisioned",
        candidateId: "north",
        ids: { agentId: "agent-n", devboxId: "dbx-n", axonId: "axn-n", threadId: "thr-n" },
      },
      {
        type: "candidate_provisioned",
        candidateId: "south",
        ids: { agentId: "agent-s", devboxId: "dbx-s", axonId: "axn-s", threadId: "thr-s" },
      },
      { type: "judge_started" },
      { type: "judge_recorded", candidateId: "north", result: failingJudge },
      { type: "judge_recorded", candidateId: "south", result: { ...failingJudge, passed: 3 } },
      { type: "candidate_selected", candidateId: "north" },
      { type: "repair_started", candidateId: "north" },
      { type: "repair_completed", candidateId: "north" },
      { type: "verification_recorded", candidateId: "north", result: passingJudge },
    ]);

    expect(state.phase).toBe("verified");
    expect(state.verdict).toBe("verified");
    expect(state.selectedCandidateId).toBe("north");
    expect(state.candidates.north.status).toBe("verified");
    expect(state.candidates.north.judge?.passed).toBe(5);
    expect(state.candidates.south.judge?.passed).toBe(3);
  });

  test("does not call a repaired patch verified before the judge reruns", () => {
    const state = reduce([
      { type: "run_started", runId: "run-2", provenance: "live", startedAt: 200 },
      { type: "judge_started" },
      { type: "judge_recorded", candidateId: "north", result: failingJudge },
      { type: "candidate_selected", candidateId: "north" },
      { type: "repair_started", candidateId: "north" },
      { type: "repair_completed", candidateId: "north" },
    ]);

    expect(state.phase).toBe("repairing");
    expect(state.verdict).toBe("repaired");
    expect(state.candidates.north.status).toBe("repaired");
  });

  test("preserves provenance, evidence, and failure detail", () => {
    const state = reduce([
      { type: "run_started", runId: "live-9", provenance: "live", startedAt: 300 },
      {
        type: "event_added",
        event: { id: "e-1", at: 310, lane: "north", kind: "runloop", label: "Devbox ready", detail: "dbx-123" },
      },
      { type: "artifact_recorded", candidateId: "north", artifact: { diff: "+ return copy", source: "source", testOutput: "2 pass" } },
      { type: "run_failed", message: "Runloop provisioning timed out" },
    ]);

    expect(state.provenance).toBe("live");
    expect(state.events).toHaveLength(1);
    expect(state.candidates.north.artifact?.diff).toContain("return copy");
    expect(state.error).toBe("Runloop provisioning timed out");
    expect(state.phase).toBe("error");
  });

  test("rekeys a provisioning run without discarding streamed evidence", () => {
    const state = reduce([
      { type: "run_started", runId: "pending", provenance: "live", startedAt: 400 },
      {
        type: "event_added",
        event: { id: "e-2", at: 405, lane: "system", kind: "runloop", label: "Creating Axon" },
      },
      { type: "run_identified", runId: "live-final" },
    ]);

    expect(state.runId).toBe("live-final");
    expect(state.events).toHaveLength(1);
    expect(state.phase).toBe("provisioning");
  });
});
