import { describe, expect, test } from "bun:test";
import type { ForgeAction } from "./forge-state.ts";
import { createInitialForgeState, forgeReducer } from "./forge-state.ts";
import { FORGE_REPLAYS, getForgeReplay } from "./forge-replay.ts";

function reduce(actions: ForgeAction[]) {
  return actions.reduce(
    forgeReducer,
    createInitialForgeState("replay", "incident-dispatch-v1"),
  );
}

describe("Forge replay chronology", () => {
  test("keeps pre-repair evidence visible until the repair actually completes", () => {
    const replay = getForgeReplay("incident-dispatch-v1");
    expect(replay).toBeDefined();
    const actions = replay!.map((step) => step.action);
    const selectedIndex = actions.findIndex(
      (action) => action.type === "candidate_selected",
    );
    const repairCompletedIndex = actions.findIndex(
      (action) => action.type === "repair_completed",
    );
    const verificationIndex = actions.findIndex(
      (action) => action.type === "verification_recorded",
    );

    const stateAfterSelection = reduce(actions.slice(0, selectedIndex + 1));
    expect(stateAfterSelection.phase).toBe("selected");
    expect(stateAfterSelection.verdict).toBe("failed");
    expect(stateAfterSelection.candidates.north.artifact?.source).not.toContain(
      "seenIds",
    );

    const stateAfterRepair = reduce(actions.slice(0, repairCompletedIndex + 2));
    expect(stateAfterRepair.verdict).toBe("repaired");
    expect(stateAfterRepair.candidates.north.artifact?.source).toContain("seenIds");

    const finalState = reduce(actions.slice(0, verificationIndex + 1));
    expect(finalState.verdict).toBe("verified");
  });

  test("does not substitute another mission when replay evidence is unavailable", () => {
    expect(getForgeReplay("retry-budget-v1")).toBeUndefined();
    expect(FORGE_REPLAYS["retry-budget-v1"]).toBeUndefined();
  });
});
