import { describe, expect, test } from "bun:test";
import type { ForgeArtifact, ForgeJudgeResult } from "./forge-types.ts";
import { computeForgeDecision } from "./forge-decision.ts";

const artifacts: Record<"north" | "south", ForgeArtifact> = {
  north: { diff: "@@\n-old\n+new\n+test", source: "north", testOutput: "pass" },
  south: { diff: "@@\n-old\n+new", source: "south", testOutput: "pass" },
};

function result(passed: number, exitCode = 1): ForgeJudgeResult {
  return {
    passed,
    total: 7,
    exitCode,
    checks: [],
    stdout: "judge output",
    stderr: "",
  };
}

describe("Forge decision record", () => {
  test("records the first tie-break field that selected the winner", () => {
    const byScore = computeForgeDecision(
      { north: result(6), south: result(5) },
      artifacts,
      1_000,
      1_350,
    );
    expect(byScore.selectedCandidateId).toBe("north");
    expect(byScore.decidedBy).toBe("passed-checks");
    expect(byScore.scores).toEqual({
      north: { passed: 6, total: 7, exitCode: 1 },
      south: { passed: 5, total: 7, exitCode: 1 },
    });
    expect(byScore.elapsedMs).toBe(350);

    const byExit = computeForgeDecision(
      { north: result(6, 1), south: result(6, 0) },
      artifacts,
      1_000,
      1_400,
    );
    expect(byExit.selectedCandidateId).toBe("south");
    expect(byExit.decidedBy).toBe("exit-code");

    const byChurn = computeForgeDecision(
      { north: result(6, 0), south: result(6, 0) },
      artifacts,
      1_000,
      1_500,
    );
    expect(byChurn.selectedCandidateId).toBe("south");
    expect(byChurn.decidedBy).toBe("changed-lines");
    expect(byChurn.changedLines).toEqual({ north: 3, south: 2 });
  });

  test("falls back to candidate id and clamps negative elapsed time", () => {
    const equalArtifacts = { north: artifacts.south, south: artifacts.south };
    const decision = computeForgeDecision(
      { north: result(7, 0), south: result(7, 0) },
      equalArtifacts,
      2_000,
      1_900,
    );

    expect(decision.selectedCandidateId).toBe("north");
    expect(decision.decidedBy).toBe("candidate-id");
    expect(decision.elapsedMs).toBe(0);
    expect(decision.decidedAt).toBe(1_900);
  });
});
