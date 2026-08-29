import { describe, expect, test } from "bun:test";
import {
  buildCandidateStartOptions,
  buildRepairPrompt,
  parseJudgeOutput,
  selectCandidate,
} from "./forge-service.ts";
import type { ForgeJudgeResult } from "../shared/forge-types.ts";

const artifacts = {
  north: { diff: "@@\n-old\n+new\n+test", source: "north", testOutput: "pass" },
  south: { diff: "@@\n-old\n+new", source: "south", testOutput: "pass" },
};

function result(passed: number, total = 5, exitCode = passed === total ? 0 : 1): ForgeJudgeResult {
  return {
    passed,
    total,
    exitCode,
    checks: [],
    stdout: "judge output",
    stderr: "",
  };
}

describe("Forge service pure contracts", () => {
  test("builds isolated, identical candidate workspaces", () => {
    const north = buildCandidateStartOptions("north");
    const south = buildCandidateStartOptions("south");

    expect(north.workingDir).toBe("/home/user/forge-target");
    expect(north.blueprintName).toBe("axon-agents");
    expect(north.model).toBe("gpt-5.6-sol");
    expect(north.launchCommands).toEqual(south.launchCommands);
    expect(north.launchCommands?.length).toBeGreaterThan(5);
  });

  test("parses the final marked judge result and preserves command evidence", () => {
    const parsed = parseJudgeOutput({
      exitCode: 1,
      stdout: [
        "warming runtime",
        'FORGE_JUDGE_RESULT={"passed":3,"total":5,"checks":[{"id":"boundary","label":"boundary","passed":false,"detail":"bad"}]}',
      ].join("\n"),
      stderr: "judge exited 1",
    });

    expect(parsed.passed).toBe(3);
    expect(parsed.total).toBe(5);
    expect(parsed.exitCode).toBe(1);
    expect(parsed.checks[0].id).toBe("boundary");
    expect(parsed.stdout).toContain("warming runtime");
    expect(parsed.stderr).toBe("judge exited 1");
  });

  test("rejects output without a machine-readable judge marker", () => {
    expect(() => parseJudgeOutput({ exitCode: 1, stdout: "syntax error", stderr: "bad" })).toThrow(
      "FORGE_JUDGE_RESULT",
    );
  });

  test("selects the most passing candidate with a stable tie-break", () => {
    expect(selectCandidate({ north: result(4), south: result(3) }, artifacts)).toBe("north");
    expect(selectCandidate({ north: result(4), south: result(4) }, artifacts)).toBe("south");
    expect(selectCandidate({ north: result(5), south: result(5) }, artifacts)).toBe("south");
  });

  test("repair prompt contains only the selected judge evidence", () => {
    const prompt = buildRepairPrompt("north", {
      ...result(4),
      checks: [
        { id: "immutable", label: "input array remains unchanged", passed: false, detail: "input array was mutated" },
        { id: "ordering", label: "ordering", passed: true, detail: "pass" },
      ],
    });

    expect(prompt).toContain("Candidate North");
    expect(prompt).toContain("input array was mutated");
    expect(prompt).not.toContain("ordering\n");
    expect(prompt).toContain("Do not inspect /home/user/forge-judge");
  });
});
