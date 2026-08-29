import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { FORGE_MISSION, buildSeedLaunchCommands } from "./forge-mission.ts";

describe("Forge mission fixture", () => {
  test("contains the complete target and external judge", () => {
    expect(Object.keys(FORGE_MISSION.targetFiles).sort()).toEqual([
      ".gitignore",
      "README.md",
      "package.json",
      "src/rank-incidents.mjs",
      "test/rank-incidents.test.mjs",
    ]);
    expect(Object.keys(FORGE_MISSION.judgeFiles)).toEqual(["judge.mjs"]);
    expect(FORGE_MISSION.judgeCommand).toContain("node /home/user/forge-judge/judge.mjs");
  });

  test("keeps candidate labels stable and public", () => {
    expect(FORGE_MISSION.candidates.map((candidate) => candidate.label)).toEqual([
      "North",
      "South",
    ]);
  });

  test("encodes every seed file without embedding source text in shell commands", () => {
    const commands = buildSeedLaunchCommands();
    const expectedCount =
      Object.keys(FORGE_MISSION.targetFiles).length +
      Object.keys(FORGE_MISSION.judgeFiles).length +
      3;

    expect(commands).toHaveLength(expectedCount);
    expect(commands[0]).toContain("mkdir -p");
    expect(commands.at(-2)).toContain("git commit");
    expect(commands.at(-1)).toContain("node --test");

    for (const source of [
      ...Object.values(FORGE_MISSION.targetFiles),
      ...Object.values(FORGE_MISSION.judgeFiles),
    ]) {
      expect(commands.join("\n")).not.toContain(source);
    }
    expect(commands.every((command) => /^[\x20-\x7e]+$/.test(command))).toBe(true);
  });

  test("runs on the blueprint's built-in Node runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "forge-mission-"));
    const target = join(root, "forge-target");
    const judge = join(root, "forge-judge");
    try {
      for (const [path, source] of Object.entries(FORGE_MISSION.targetFiles)) {
        const destination = join(target, path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, source, "utf8");
      }
      for (const [path, source] of Object.entries(FORGE_MISSION.judgeFiles)) {
        const destination = join(judge, path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, source, "utf8");
      }

      const visible = spawnSync("node", ["--test"], { cwd: target, encoding: "utf8" });
      const hidden = spawnSync("node", [join(judge, "judge.mjs")], { cwd: target, encoding: "utf8" });

      expect(visible.status).toBe(0);
      expect(hidden.status).toBe(1);
      expect(hidden.stdout).toContain("FORGE_JUDGE_RESULT=");
      const payload = hidden.stdout.split("FORGE_JUDGE_RESULT=").at(-1)?.trim();
      const result = JSON.parse(payload ?? "{}") as { total?: number; checks?: Array<{ id: string }> };
      expect(result.total).toBe(6);
      expect(result.checks?.some((check) => check.id === "unique-ids")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
