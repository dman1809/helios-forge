import type {
  ForgeAgentIds,
  ForgeArtifact,
  ForgeCandidateId,
  ForgeEvent,
  ForgeJudgeResult,
  ForgeProvenance,
  ForgeRunState,
} from "../shared/forge-types.ts";

export type ForgeAction =
  | { type: "reset"; provenance: ForgeProvenance }
  | { type: "run_started"; runId: string; provenance: ForgeProvenance; startedAt: number }
  | { type: "run_identified"; runId: string }
  | { type: "candidate_provisioned"; candidateId: ForgeCandidateId; ids: ForgeAgentIds }
  | { type: "candidate_running"; candidateId: ForgeCandidateId }
  | { type: "judge_started" }
  | { type: "judge_recorded"; candidateId: ForgeCandidateId; result: ForgeJudgeResult }
  | { type: "candidate_selected"; candidateId: ForgeCandidateId }
  | { type: "repair_started"; candidateId: ForgeCandidateId }
  | { type: "repair_completed"; candidateId: ForgeCandidateId }
  | { type: "verification_recorded"; candidateId: ForgeCandidateId; result: ForgeJudgeResult }
  | { type: "artifact_recorded"; candidateId: ForgeCandidateId; artifact: ForgeArtifact }
  | { type: "event_added"; event: ForgeEvent }
  | { type: "run_failed"; message: string };

export function createInitialForgeState(provenance: ForgeProvenance): ForgeRunState {
  return {
    runId: null,
    provenance,
    phase: "idle",
    verdict: "ready",
    startedAt: null,
    selectedCandidateId: null,
    candidates: {
      north: {
        id: "north",
        label: "North",
        strategy: "Minimal patch",
        status: "queued",
        ids: null,
        judge: null,
        artifact: null,
      },
      south: {
        id: "south",
        label: "South",
        strategy: "Contract-first patch",
        status: "queued",
        ids: null,
        judge: null,
        artifact: null,
      },
    },
    events: [],
    error: null,
  };
}

function updateCandidate(
  state: ForgeRunState,
  candidateId: ForgeCandidateId,
  patch: Partial<ForgeRunState["candidates"][ForgeCandidateId]>,
): ForgeRunState {
  return {
    ...state,
    candidates: {
      ...state.candidates,
      [candidateId]: { ...state.candidates[candidateId], ...patch },
    },
  };
}

export function forgeReducer(state: ForgeRunState, action: ForgeAction): ForgeRunState {
  switch (action.type) {
    case "reset":
      return createInitialForgeState(action.provenance);
    case "run_started": {
      const next = createInitialForgeState(action.provenance);
      return {
        ...next,
        runId: action.runId,
        startedAt: action.startedAt,
        phase: "provisioning",
        verdict: "running",
        candidates: {
          north: { ...next.candidates.north, status: "provisioning" },
          south: { ...next.candidates.south, status: "provisioning" },
        },
      };
    }
    case "run_identified":
      return { ...state, runId: action.runId };
    case "candidate_provisioned": {
      const next = updateCandidate(state, action.candidateId, {
        ids: action.ids,
        status: "running",
      });
      const bothReady = Object.values(next.candidates).every((candidate) => candidate.ids !== null);
      return bothReady ? { ...next, phase: "competing" } : next;
    }
    case "candidate_running":
      return updateCandidate(state, action.candidateId, { status: "running" });
    case "judge_started":
      return {
        ...state,
        phase: "judging",
        candidates: {
          north: { ...state.candidates.north, status: "judging" },
          south: { ...state.candidates.south, status: "judging" },
        },
      };
    case "judge_recorded":
      return updateCandidate(state, action.candidateId, {
        judge: action.result,
        status: "judged",
      });
    case "candidate_selected": {
      const judge = state.candidates[action.candidateId].judge;
      const passed = judge !== null && judge.passed === judge.total;
      const next = updateCandidate(state, action.candidateId, { status: "selected" });
      return {
        ...next,
        selectedCandidateId: action.candidateId,
        verdict: passed ? "verified" : "failed",
        phase: passed ? "verified" : next.phase,
      };
    }
    case "repair_started":
      return {
        ...updateCandidate(state, action.candidateId, { status: "repairing" }),
        phase: "repairing",
        verdict: "failed",
      };
    case "repair_completed":
      return {
        ...updateCandidate(state, action.candidateId, { status: "repaired" }),
        phase: "repairing",
        verdict: "repaired",
      };
    case "verification_recorded": {
      const verified = action.result.passed === action.result.total && action.result.exitCode === 0;
      return {
        ...updateCandidate(state, action.candidateId, {
          judge: action.result,
          status: verified ? "verified" : "failed",
        }),
        phase: verified ? "verified" : "repairing",
        verdict: verified ? "verified" : "failed",
      };
    }
    case "artifact_recorded":
      return updateCandidate(state, action.candidateId, { artifact: action.artifact });
    case "event_added":
      return { ...state, events: [...state.events, action.event] };
    case "run_failed":
      return { ...state, phase: "error", verdict: "error", error: action.message };
  }
}
