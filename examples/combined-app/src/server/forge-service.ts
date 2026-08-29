import { randomUUID } from "node:crypto";
import type { AgentRegistry } from "./agent-registry.ts";
import {
  CodexConnectionManager,
  type CodexStartOptions,
  type DevboxCommandResult,
} from "./codex-manager.ts";
import { HttpError } from "./http-errors.ts";
import type { WsBroadcaster } from "./ws.ts";
import { FORGE_MISSION, buildSeedLaunchCommands } from "../shared/forge-mission.ts";
import { computeForgeDecision } from "../shared/forge-decision.ts";
import type {
  ForgeAgentIds,
  ForgeArtifact,
  ForgeCandidateId,
  ForgeJudgeResponse,
  ForgeJudgeResult,
  ForgeStartResponse,
} from "../shared/forge-types.ts";

interface LiveCandidate {
  id: ForgeCandidateId;
  manager: CodexConnectionManager;
  ids: ForgeAgentIds;
}

interface LiveRun {
  id: string;
  startedAt: number;
  candidates: Record<ForgeCandidateId, LiveCandidate>;
  selectedCandidateId: ForgeCandidateId | null;
}

const JUDGE_MARKER = "FORGE_JUDGE_RESULT=";

export function buildCandidateStartOptions(_candidateId: ForgeCandidateId): CodexStartOptions {
  return {
    blueprintName: "axon-agents",
    model: "gpt-5.6-sol",
    workingDir: FORGE_MISSION.targetRoot,
    launchCommands: buildSeedLaunchCommands(),
    autoApprovePermissions: true,
    systemPrompt:
      "You are a named Helios Forge candidate. Work only on the supplied mission, preserve evidence, and never inspect the external judge directory.",
  };
}

export function parseJudgeOutput(execution: DevboxCommandResult): ForgeJudgeResult {
  const markerIndex = execution.stdout.lastIndexOf(JUDGE_MARKER);
  if (markerIndex < 0) {
    throw new Error(`Judge output missing ${JUDGE_MARKER}`);
  }
  const payload = execution.stdout
    .slice(markerIndex + JUDGE_MARKER.length)
    .split(/\r?\n/, 1)[0]
    .trim();
  const parsed = JSON.parse(payload) as Pick<ForgeJudgeResult, "passed" | "total" | "checks">;
  if (
    !Number.isInteger(parsed.passed) ||
    !Number.isInteger(parsed.total) ||
    !Array.isArray(parsed.checks)
  ) {
    throw new Error("Judge result has an invalid shape");
  }
  return {
    passed: parsed.passed,
    total: parsed.total,
    checks: parsed.checks,
    exitCode: execution.exitCode,
    stdout: execution.stdout,
    stderr: execution.stderr,
  };
}

export function selectCandidate(
  results: Record<ForgeCandidateId, ForgeJudgeResult>,
  artifacts: Record<ForgeCandidateId, ForgeArtifact>,
): ForgeCandidateId {
  return computeForgeDecision(results, artifacts, 0, 0).selectedCandidateId;
}

export function buildRepairPrompt(
  candidateId: ForgeCandidateId,
  result: ForgeJudgeResult,
): string {
  const label = candidateId === "north" ? "North" : "South";
  const failures = result.checks
    .filter((check) => !check.passed)
    .map((check) => `- ${check.label}: ${check.detail}`)
    .join("\n");
  return `Candidate ${label}, the external deterministic judge selected your patch but found these remaining regressions:\n${failures}\n\nRepair only those failures in ${FORGE_MISSION.targetRoot}. Preserve all passing behavior, run the visible tests, and leave the repair uncommitted. Do not inspect ${FORGE_MISSION.judgeRoot}. Report the changed file and visible test result.`;
}

export class ForgeService {
  private runs = new Map<string, LiveRun>();

  constructor(
    private registry: AgentRegistry,
    private ws: WsBroadcaster,
  ) {}

  async start(): Promise<ForgeStartResponse> {
    const runId = randomUUID().slice(0, 12);
    const candidateIds: ForgeCandidateId[] = ["north", "south"];
    const pending = candidateIds.map((candidateId) => {
      const agentId = this.registry.generateId();
      const manager = new CodexConnectionManager(this.ws, agentId);
      return { candidateId, agentId, manager };
    });

    const starts = await Promise.allSettled(
      pending.map(async ({ candidateId, agentId, manager }) => {
        const started = await manager.start(buildCandidateStartOptions(candidateId));
        return {
          id: candidateId,
          manager,
          ids: {
            agentId,
            devboxId: started.devboxId,
            axonId: started.axonId,
            threadId: started.threadId,
          },
        } satisfies LiveCandidate;
      }),
    );

    const rejected = starts.find((start) => start.status === "rejected");
    if (rejected) {
      await Promise.allSettled(pending.map(({ manager }) => manager.shutdown()));
      throw rejected.reason;
    }

    const candidates = Object.fromEntries(
      starts.map((start) => {
        if (start.status !== "fulfilled") throw new Error("Unreachable start state");
        return [start.value.id, start.value];
      }),
    ) as Record<ForgeCandidateId, LiveCandidate>;

    for (const candidate of Object.values(candidates)) {
      const mission = FORGE_MISSION.candidates.find((item) => item.id === candidate.id)!;
      this.registry.add({
        id: candidate.ids.agentId,
        agentType: "codex",
        name: `Forge ${mission.label}`,
        axonId: candidate.ids.axonId,
        devboxId: candidate.ids.devboxId,
        createdAt: Date.now(),
        codexManager: candidate.manager,
      });
    }

    const run: LiveRun = {
      id: runId,
      startedAt: Date.now(),
      candidates,
      selectedCandidateId: null,
    };
    this.runs.set(runId, run);

    await Promise.all(
      Object.values(candidates).map((candidate) => {
        const prompt = FORGE_MISSION.candidates.find((item) => item.id === candidate.id)!.prompt;
        return candidate.manager.send(prompt);
      }),
    );

    return {
      runId,
      candidates: {
        north: candidates.north.ids,
        south: candidates.south.ids,
      },
    };
  }

  async judge(runId: string): Promise<ForgeJudgeResponse> {
    const run = this.requireRun(runId);
    const entries = await Promise.all(
      (["north", "south"] as ForgeCandidateId[]).map(async (candidateId) => {
        const candidate = run.candidates[candidateId];
        const [judgeExecution, artifact] = await Promise.all([
          candidate.manager.executeCommand(FORGE_MISSION.judgeCommand),
          this.captureArtifact(candidate.manager),
        ]);
        return [candidateId, parseJudgeOutput(judgeExecution), artifact] as const;
      }),
    );

    const results = Object.fromEntries(
      entries.map(([candidateId, result]) => [candidateId, result]),
    ) as Record<ForgeCandidateId, ForgeJudgeResult>;
    const artifacts = Object.fromEntries(
      entries.map(([candidateId, , artifact]) => [candidateId, artifact]),
    ) as Record<ForgeCandidateId, ForgeArtifact>;
    const decision = computeForgeDecision(results, artifacts, run.startedAt, Date.now());
    run.selectedCandidateId = decision.selectedCandidateId;
    return {
      selectedCandidateId: decision.selectedCandidateId,
      decision,
      results,
      artifacts,
    };
  }

  async repair(runId: string): Promise<{ candidateId: ForgeCandidateId; ok: true }> {
    const run = this.requireRun(runId);
    if (!run.selectedCandidateId) throw new HttpError(409, "Judge the candidates before repair");
    const selected = run.candidates[run.selectedCandidateId];
    const execution = await selected.manager.executeCommand(FORGE_MISSION.judgeCommand);
    const result = parseJudgeOutput(execution);
    await selected.manager.send(buildRepairPrompt(run.selectedCandidateId, result));
    return { candidateId: run.selectedCandidateId, ok: true };
  }

  async verify(runId: string): Promise<{
    candidateId: ForgeCandidateId;
    result: ForgeJudgeResult;
    artifact: ForgeArtifact;
  }> {
    const run = this.requireRun(runId);
    if (!run.selectedCandidateId) throw new HttpError(409, "No selected candidate");
    const selected = run.candidates[run.selectedCandidateId];
    const [execution, artifact] = await Promise.all([
      selected.manager.executeCommand(FORGE_MISSION.judgeCommand),
      this.captureArtifact(selected.manager),
    ]);
    return {
      candidateId: run.selectedCandidateId,
      result: parseJudgeOutput(execution),
      artifact,
    };
  }

  async artifacts(runId: string, candidateId: ForgeCandidateId): Promise<ForgeArtifact> {
    return this.captureArtifact(this.requireRun(runId).candidates[candidateId].manager);
  }

  async shutdown(runId: string): Promise<void> {
    const run = this.requireRun(runId);
    await Promise.all(
      Object.values(run.candidates).map((candidate) =>
        this.registry.shutdown(candidate.ids.agentId),
      ),
    );
    this.runs.delete(runId);
  }

  private requireRun(runId: string): LiveRun {
    const run = this.runs.get(runId);
    if (!run) throw new HttpError(404, `Forge run ${runId} not found`);
    return run;
  }

  private async captureArtifact(manager: CodexConnectionManager): Promise<ForgeArtifact> {
    const [diff, source, tests] = await Promise.all([
      manager.executeCommand(
        `cd '${FORGE_MISSION.targetRoot}' && git diff --no-ext-diff -- src/rank-incidents.mjs test/rank-incidents.test.mjs`,
      ),
      manager.readFile(`${FORGE_MISSION.targetRoot}/src/rank-incidents.mjs`),
      manager.executeCommand(`cd '${FORGE_MISSION.targetRoot}' && node --test`),
    ]);
    return {
      diff: diff.stdout || diff.stderr,
      source,
      testOutput: [tests.stdout, tests.stderr].filter(Boolean).join("\n"),
    };
  }
}
