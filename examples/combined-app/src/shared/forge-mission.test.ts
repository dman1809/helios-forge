import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  FORGE_MISSIONS,
  buildSeedLaunchCommands,
  getForgeMission,
} from "./forge-missions.ts";
import type { ForgeMission, ForgeMissionId } from "./missions/mission-types.ts";

async function materializeMission(mission: ForgeMission, root: string) {
  const target = join(root, "forge-target");
  const judge = join(root, "forge-judge");

  for (const [path, source] of Object.entries(mission.targetFiles)) {
    const destination = join(target, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source, "utf8");
  }
  for (const [path, source] of Object.entries(mission.judgeFiles)) {
    const destination = join(judge, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source, "utf8");
  }

  return { target, judge };
}

describe("Forge mission registry", () => {
  test("contains both complete deterministic missions", () => {
    expect(Object.keys(FORGE_MISSIONS)).toEqual([
      "incident-dispatch-v1",
      "retry-budget-v1",
    ]);

    const retry = getForgeMission("retry-budget-v1");
    expect(retry.judgeFiles["judge.mjs"]).toContain('check("budget"');
    expect(retry.artifactPaths).toEqual([
      "src/allocate-retries.mjs",
      "test/allocate-retries.test.mjs",
    ]);
    expect(retry.sourcePath).toBe("src/allocate-retries.mjs");
  });

  test("rejects an unknown mission id", () => {
    expect(() => getForgeMission("unknown" as ForgeMissionId)).toThrow(
      "Unknown Forge mission",
    );
  });

  test("keeps candidate labels stable and public", () => {
    for (const mission of Object.values(FORGE_MISSIONS)) {
      expect(mission.candidates.map((candidate) => candidate.label)).toEqual([
        "North",
        "South",
      ]);
    }
  });

  test("encodes every seed file without embedding source text", () => {
    for (const mission of Object.values(FORGE_MISSIONS)) {
      const commands = buildSeedLaunchCommands(mission);
      const expectedCount =
        Object.keys(mission.targetFiles).length +
        Object.keys(mission.judgeFiles).length +
        3;

      expect(commands).toHaveLength(expectedCount);
      expect(commands[0]).toContain("mkdir -p");
      expect(commands.at(-2)).toContain("git commit");
      expect(commands.at(-1)).toContain(mission.testCommand);

      for (const source of [
        ...Object.values(mission.targetFiles),
        ...Object.values(mission.judgeFiles),
      ]) {
        expect(commands.join("\n")).not.toContain(source);
      }
      expect(commands.every((command) => /^[\x20-\x7e]+$/.test(command))).toBe(true);
    }
  });

  for (const missionId of [
    "incident-dispatch-v1",
    "retry-budget-v1",
  ] satisfies ForgeMissionId[]) {
    test(`${missionId} runs on the blueprint Node runtime`, async () => {
      const root = await mkdtemp(join(tmpdir(), `forge-${missionId}-`));
      try {
        const mission = getForgeMission(missionId);
        const { target, judge } = await materializeMission(mission, root);
        const visible = spawnSync("node", ["--test"], {
          cwd: target,
          encoding: "utf8",
        });
        const hidden = spawnSync("node", [join(judge, "judge.mjs")], {
          cwd: target,
          encoding: "utf8",
        });

        expect(visible.status).toBe(0);
        expect(hidden.status).toBe(1);
        expect(hidden.stdout).toContain("FORGE_JUDGE_RESULT=");
        const payload = hidden.stdout.split("FORGE_JUDGE_RESULT=").at(-1)?.trim();
        const result = JSON.parse(payload ?? "{}") as {
          total?: number;
          checks?: Array<{ id: string }>;
        };
        expect(result.total).toBeGreaterThanOrEqual(6);
        expect(result.checks?.some((check) => check.id === "unique-ids")).toBe(true);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});
