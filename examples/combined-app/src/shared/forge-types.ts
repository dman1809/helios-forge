import type { ForgeMissionId } from "./missions/mission-types.ts";

export type ForgeProvenance = "live" | "replay";
export type ForgePhase =
  | "idle"
  | "provisioning"
  | "competing"
  | "judging"
  | "selected"
  | "repairing"
  | "verified"
  | "error";
export type ForgeVerdict = "ready" | "running" | "failed" | "repaired" | "verified" | "error";
export type ForgeCandidateId = "north" | "south";
export type ForgeCandidateStatus =
  | "queued"
  | "provisioning"
  | "running"
  | "judging"
  | "judged"
  | "selected"
  | "repairing"
  | "repaired"
  | "verified"
  | "failed";

export interface ForgeCheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ForgeJudgeResult {
  passed: number;
  total: number;
  exitCode: number;
  checks: ForgeCheckResult[];
  stdout: string;
  stderr: string;
}

export interface ForgeAgentIds {
  agentId: string;
  devboxId: string;
  axonId: string;
  threadId: string | null;
}

export interface ForgeArtifact {
  diff: string;
  source: string;
  testOutput: string;
}

export interface ForgeDecision {
  selectedCandidateId: ForgeCandidateId;
  decidedBy: "passed-checks" | "exit-code" | "changed-lines" | "candidate-id";
  changedLines: Record<ForgeCandidateId, number>;
  elapsedMs: number;
  decidedAt: number;
}

export interface ForgeCandidateState {
  id: ForgeCandidateId;
  label: string;
  strategy: string;
  status: ForgeCandidateStatus;
  ids: ForgeAgentIds | null;
  judge: ForgeJudgeResult | null;
  artifact: ForgeArtifact | null;
}

export interface ForgeEvent {
  id: string;
  at: number;
  lane: ForgeCandidateId | "judge" | "system";
  kind: "runloop" | "codex" | "command" | "verdict" | "system";
  label: string;
  detail?: string;
}

export interface ForgeRunState {
  runId: string | null;
  missionId: ForgeMissionId;
  provenance: ForgeProvenance;
  phase: ForgePhase;
  verdict: ForgeVerdict;
  startedAt: number | null;
  selectedCandidateId: ForgeCandidateId | null;
  decision: ForgeDecision | null;
  candidates: Record<ForgeCandidateId, ForgeCandidateState>;
  events: ForgeEvent[];
  error: string | null;
}

export interface ForgeStartResponse {
  runId: string;
  candidates: Record<ForgeCandidateId, ForgeAgentIds>;
}

export interface ForgeJudgeResponse {
  selectedCandidateId: ForgeCandidateId;
  decision: ForgeDecision;
  results: Record<ForgeCandidateId, ForgeJudgeResult>;
  artifacts: Record<ForgeCandidateId, ForgeArtifact>;
}
