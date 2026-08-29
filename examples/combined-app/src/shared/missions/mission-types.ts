export type ForgeMissionId = "incident-dispatch-v1" | "retry-budget-v1";

export type ForgeCandidateId = "north" | "south";

export interface ForgeCandidate {
  id: ForgeCandidateId;
  label: "North" | "South";
  strategy: string;
  prompt: string;
}

export interface ForgeMission {
  id: ForgeMissionId;
  number: string;
  title: string;
  brief: string;
  category: string;
  targetRoot: string;
  judgeRoot: string;
  targetFiles: Readonly<Record<string, string>>;
  judgeFiles: Readonly<Record<string, string>>;
  judgeCommand: string;
  testCommand: string;
  artifactPaths: readonly string[];
  sourcePath: string;
  candidates: readonly ForgeCandidate[];
}
