import type {
  ForgeArtifact,
  ForgeCandidateId,
  ForgeDecision,
  ForgeJudgeResult,
} from "./forge-types.ts";

const CANDIDATE_IDS: ForgeCandidateId[] = ["north", "south"];

export function changedLineCount(diff: string): number {
  return diff
    .split(/\r?\n/)
    .filter(
      (line) =>
        (line.startsWith("+") && !line.startsWith("+++")) ||
        (line.startsWith("-") && !line.startsWith("---")),
    ).length;
}

export function computeForgeDecision(
  results: Record<ForgeCandidateId, ForgeJudgeResult>,
  artifacts: Record<ForgeCandidateId, ForgeArtifact>,
  startedAt: number,
  decidedAt: number,
): ForgeDecision {
  const changedLines: Record<ForgeCandidateId, number> = {
    north: changedLineCount(artifacts.north.diff),
    south: changedLineCount(artifacts.south.diff),
  };

  let decidedBy: ForgeDecision["decidedBy"] = "candidate-id";
  if (results.north.passed !== results.south.passed) {
    decidedBy = "passed-checks";
  } else if (results.north.exitCode !== results.south.exitCode) {
    decidedBy = "exit-code";
  } else if (changedLines.north !== changedLines.south) {
    decidedBy = "changed-lines";
  }

  const selectedCandidateId = [...CANDIDATE_IDS].sort((left, right) => {
    const scoreDifference = results[right].passed - results[left].passed;
    if (scoreDifference !== 0) return scoreDifference;
    const exitDifference = results[left].exitCode - results[right].exitCode;
    if (exitDifference !== 0) return exitDifference;
    const churnDifference = changedLines[left] - changedLines[right];
    if (churnDifference !== 0) return churnDifference;
    return left.localeCompare(right);
  })[0];

  return {
    selectedCandidateId,
    decidedBy,
    changedLines,
    elapsedMs: Math.max(0, decidedAt - startedAt),
    decidedAt,
  };
}
