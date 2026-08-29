import { getForgeMission } from "../shared/forge-missions.ts";
import type { ForgeCheckResult, ForgeRunState } from "../shared/forge-types.ts";

const MAX_EVENTS = 250;
const MAX_DETAIL_LENGTH = 500;
const MAX_DIFF_LENGTH = 120_000;
const SENSITIVE_TEXT = /(auth|credential|password|secret|token|api[_-]?key)/i;

function sanitizeText(value: string | undefined, limit: number): string | undefined {
  if (value === undefined) return undefined;
  if (SENSITIVE_TEXT.test(value)) return "[redacted]";
  return value.slice(0, limit);
}

function sanitizeChecks(checks: ForgeCheckResult[]) {
  return checks.map((check) => ({
    id: sanitizeText(check.id, MAX_DETAIL_LENGTH) ?? "check",
    label: sanitizeText(check.label, MAX_DETAIL_LENGTH) ?? "Check",
    passed: check.passed,
    detail: sanitizeText(check.detail, MAX_DETAIL_LENGTH) ?? "",
  }));
}

export function buildForgeRunReport(state: ForgeRunState) {
  const mission = getForgeMission(state.missionId);

  return {
    schemaVersion: 1 as const,
    mission: {
      id: mission.id,
      number: mission.number,
      title: mission.title,
      category: mission.category,
      brief: mission.brief,
    },
    run: {
      runId: state.runId,
      provenance: state.provenance,
      phase: state.phase,
      verdict: state.verdict,
      startedAt: state.startedAt,
      selectedCandidateId: state.selectedCandidateId,
    },
    decision: state.decision,
    candidates: Object.fromEntries(
      Object.entries(state.candidates).map(([candidateId, candidate]) => [
        candidateId,
        {
          id: candidate.id,
          label: candidate.label,
          strategy: candidate.strategy,
          status: candidate.status,
          resources: candidate.ids,
          score: candidate.judge
            ? {
                passed: candidate.judge.passed,
                total: candidate.judge.total,
                exitCode: candidate.judge.exitCode,
                checks: sanitizeChecks(candidate.judge.checks),
              }
            : null,
          finalDiff: candidate.artifact
            ? sanitizeText(candidate.artifact.diff, MAX_DIFF_LENGTH)
            : null,
        },
      ]),
    ) as Record<
      "north" | "south",
      {
        id: string;
        label: string;
        strategy: string;
        status: string;
        resources: ForgeRunState["candidates"]["north"]["ids"];
        score: {
          passed: number;
          total: number;
          exitCode: number;
          checks: ReturnType<typeof sanitizeChecks>;
        } | null;
        finalDiff: string | null | undefined;
      }
    >,
    events: state.events.slice(-MAX_EVENTS).map((event) => ({
      id: event.id,
      at: event.at,
      lane: event.lane,
      kind: event.kind,
      label: sanitizeText(event.label, MAX_DETAIL_LENGTH) ?? "Event",
      detail: sanitizeText(event.detail, MAX_DETAIL_LENGTH),
    })),
  };
}

export function downloadForgeRunReport(state: ForgeRunState): void {
  const report = buildForgeRunReport(state);
  const runId = (state.runId ?? "replay").replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename = `helios-forge-${report.mission.number}-${runId}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
