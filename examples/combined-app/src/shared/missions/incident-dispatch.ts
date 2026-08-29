import { FORGE_MISSION } from "../forge-mission.ts";
import type { ForgeMission } from "./mission-types.ts";

export const INCIDENT_DISPATCH_MISSION: ForgeMission = {
  ...FORGE_MISSION,
  number: "01",
  category: "Queue integrity",
  testCommand: "node --test",
  artifactPaths: ["src/rank-incidents.mjs", "test/rank-incidents.test.mjs"],
  sourcePath: "src/rank-incidents.mjs",
};
