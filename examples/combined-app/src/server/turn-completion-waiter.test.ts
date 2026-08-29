import { describe, expect, test } from "bun:test";
import { TurnCompletionWaiter } from "./turn-completion-waiter.ts";

describe("TurnCompletionWaiter", () => {
  test("registers before sending and resolves on the next completed turn", async () => {
    const waiter = new TurnCompletionWaiter();
    const result = waiter.wait(async () => {
      expect(waiter.completeNext()).toBe(true);
    }, 100);

    await expect(result).resolves.toBeUndefined();
    expect(waiter.completeNext()).toBe(false);
  });

  test("rejects and removes a waiter on timeout", async () => {
    const waiter = new TurnCompletionWaiter();
    await expect(waiter.wait(async () => {}, 5)).rejects.toThrow("timed out");
    expect(waiter.completeNext()).toBe(false);
  });

  test("rejects outstanding work on disconnect or shutdown", async () => {
    const waiter = new TurnCompletionWaiter();
    const pending = waiter.wait(async () => {}, 1_000);
    waiter.rejectPending(new Error("Codex disconnected"));

    await expect(pending).rejects.toThrow("Codex disconnected");
    expect(waiter.completeNext()).toBe(false);
  });

  test("fails closed when a second turn waiter is registered", async () => {
    const waiter = new TurnCompletionWaiter();
    const first = waiter.wait(async () => {}, 1_000);
    await expect(waiter.wait(async () => {}, 1_000)).rejects.toThrow(
      "already waiting",
    );
    waiter.rejectPending(new Error("test cleanup"));
    await expect(first).rejects.toThrow("test cleanup");
  });
});
