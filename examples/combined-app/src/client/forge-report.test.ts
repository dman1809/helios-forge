import { describe, expect, test } from "bun:test";
import { createInitialForgeState } from "./forge-state.ts";
import { buildForgeRunReport } from "./forge-report.ts";

describe("Forge evidence report", () => {
  test("builds a versioned, mission-aware, content-light report", () => {
    const initial = createInitialForgeState("live", "retry-budget-v1");
    const state = {
      ...initial,
      runId: "run-02",
      phase: "selected" as const,
      verdict: "failed" as const,
      startedAt: 1_000,
      selectedCandidateId: "south" as const,
      decision: {
        selectedCandidateId: "south" as const,
        decidedBy: "changed-lines" as const,
        scores: {
          north: { passed: 6, total: 7, exitCode: 1 },
          south: { passed: 6, total: 7, exitCode: 1 },
        },
        changedLines: { north: 8, south: 4 },
        elapsedMs: 820,
        decidedAt: 1_820,
      },
      events: [
        {
          id: "event-1",
          at: 1_200,
          lane: "judge" as const,
          kind: "verdict" as const,
          label: "Judge complete",
          detail: "CODEx_AUTH_JSON=must-not-export",
        },
      ],
      candidates: {
        ...initial.candidates,
        south: {
          ...initial.candidates.south,
          status: "selected" as const,
          ids: {
            agentId: "agent-s",
            devboxId: "dbx-s",
            axonId: "axon-s",
            threadId: "thread-s",
          },
          judge: {
            passed: 6,
            total: 7,
            exitCode: 1,
            checks: [
              { id: "budget", label: "selection remains within budget", passed: false, detail: "cost 9" },
            ],
            stdout: "FORGE_JUDGE_RESULT={secret-unbounded-frame}",
            stderr: "CODEx_AUTH_JSON=also-secret",
          },
          artifact: {
            diff: "@@ -1 +1 @@\n-return all\n+return selected",
            source: "source is intentionally not exported",
            testOutput: "test output is intentionally not exported",
          },
        },
      },
    };

    const report = buildForgeRunReport(state);
    const serialized = JSON.stringify(report);

    expect(report.schemaVersion).toBe(1);
    expect(report.mission.id).toBe("retry-budget-v1");
    expect(report.mission.number).toBe("02");
    expect(report.run.selectedCandidateId).toBe("south");
    expect(report.candidates.south.score?.passed).toBe(6);
    expect(report.candidates.south.finalDiff).toContain("return selected");
    expect(report.events[0].detail).toBe("[redacted]");
    expect(serialized).not.toContain("FORGE_JUDGE_RESULT=");
    expect(serialized).not.toContain("CODEx_AUTH_JSON");
    expect(serialized).not.toContain("source is intentionally not exported");
    expect(serialized).not.toContain("test output is intentionally not exported");
  });
});
