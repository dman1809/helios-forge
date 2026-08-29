import { INCIDENT_DISPATCH_MISSION } from "./missions/incident-dispatch.ts";
import type { ForgeMission, ForgeMissionId } from "./missions/mission-types.ts";
import { RETRY_BUDGET_MISSION } from "./missions/retry-budget.ts";

export const FORGE_MISSIONS = {
  "incident-dispatch-v1": INCIDENT_DISPATCH_MISSION,
  "retry-budget-v1": RETRY_BUDGET_MISSION,
} as const satisfies Record<ForgeMissionId, ForgeMission>;

export const FORGE_MISSION = FORGE_MISSIONS["incident-dispatch-v1"];

export function getForgeMission(missionId: ForgeMissionId): ForgeMission {
  const mission = FORGE_MISSIONS[missionId];
  if (!mission) {
    throw new Error(`Unknown Forge mission: ${missionId}`);
  }
  return mission;
}

function encodeFileCommand(root: string, path: string, source: string): string {
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return `printf '%s' '${encoded}' | base64 -d > '${root}/${path}'`;
}

export function buildSeedLaunchCommands(
  mission: ForgeMission = FORGE_MISSION,
): string[] {
  const commands = [
    `mkdir -p '${mission.targetRoot}/src' '${mission.targetRoot}/test' '${mission.judgeRoot}'`,
  ];

  for (const [path, source] of Object.entries(mission.targetFiles)) {
    commands.push(encodeFileCommand(mission.targetRoot, path, source));
  }
  for (const [path, source] of Object.entries(mission.judgeFiles)) {
    commands.push(encodeFileCommand(mission.judgeRoot, path, source));
  }

  commands.push(
    `cd '${mission.targetRoot}' && git init -q && git config user.email 'forge@localhost' && git config user.name 'Helios Forge' && git add . && git commit -qm 'seed mission'`,
    `cd '${mission.targetRoot}' && ${mission.testCommand}`,
  );
  return commands;
}
