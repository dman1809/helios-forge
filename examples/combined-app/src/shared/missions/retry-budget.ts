import type { ForgeMission } from "./mission-types.ts";

const TARGET_ROOT = "/home/user/forge-target";
const JUDGE_ROOT = "/home/user/forge-judge";

const targetFiles = {
  ".gitignore": ".forge-artifacts/\n",
  "README.md": `# Retry Budget Allocator

The allocator selects failed work for another attempt without exceeding the available retry budget.

## Contract

- Only failed, non-permanent requests are eligible.
- Priority order is urgent, normal, then low.
- Within a priority, requests with fewer prior attempts come first.
- Exact ties retain their input order.
- Duplicate ids collapse to the first eligible occurrence.
- Selected retry cost never exceeds the budget.
- An over-budget request does not prevent a later affordable request from being selected.
- Allocation never mutates the caller's array.

Run the visible suite with \`node --test\`.
`,
  "package.json": `{
  "name": "retry-budget-allocator",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
`,
  "src/allocate-retries.mjs": `const priorityWeight = {
  urgent: 3,
  normal: 2,
  low: 1,
};

export function allocateRetries(requests, _budget) {
  return requests
    .filter((request) => request.status === "failed" && !request.permanent)
    .sort(
      (left, right) =>
        priorityWeight[right.priority] - priorityWeight[left.priority] ||
        left.attempts - right.attempts,
    );
}
`,
  "test/allocate-retries.test.mjs": `import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { allocateRetries } from "../src/allocate-retries.mjs";

describe("allocateRetries", () => {
  test("orders eligible work by priority and prior attempts", () => {
    const requests = [
      { id: "low", status: "failed", permanent: false, priority: "low", attempts: 0, retryCost: 1 },
      { id: "urgent-two", status: "failed", permanent: false, priority: "urgent", attempts: 2, retryCost: 1 },
      { id: "urgent-one", status: "failed", permanent: false, priority: "urgent", attempts: 1, retryCost: 1 },
      { id: "normal", status: "failed", permanent: false, priority: "normal", attempts: 0, retryCost: 1 },
    ];

    assert.deepEqual(allocateRetries(requests, 10).map((request) => request.id), [
      "urgent-one",
      "urgent-two",
      "normal",
      "low",
    ]);
  });

  test("excludes completed and permanent requests", () => {
    const requests = [
      { id: "completed", status: "completed", permanent: false, priority: "urgent", attempts: 0, retryCost: 1 },
      { id: "permanent", status: "failed", permanent: true, priority: "urgent", attempts: 0, retryCost: 1 },
      { id: "eligible", status: "failed", permanent: false, priority: "normal", attempts: 0, retryCost: 1 },
    ];

    assert.deepEqual(allocateRetries(requests, 10).map((request) => request.id), ["eligible"]);
  });
});
`,
} as const;

const judgeFiles = {
  "judge.mjs": `import { allocateRetries } from "../forge-target/src/allocate-retries.mjs";

const checks = [];

function equal(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function check(id, label, run) {
  try {
    run();
    checks.push({ id, label, passed: true, detail: "pass" });
  } catch (error) {
    checks.push({
      id,
      label,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const request = (id, overrides = {}) => ({
  id,
  status: "failed",
  permanent: false,
  priority: "normal",
  attempts: 0,
  retryCost: 1,
  ...overrides,
});

check("ordering", "priority and attempt ordering", () => {
  const input = [
    request("low", { priority: "low" }),
    request("urgent-two", { priority: "urgent", attempts: 2 }),
    request("urgent-zero", { priority: "urgent", attempts: 0 }),
    request("normal", { priority: "normal" }),
  ];
  const ids = allocateRetries(input, 20).map((entry) => entry.id);
  assert(equal(ids, ["urgent-zero", "urgent-two", "normal", "low"]), "ordering changed");
});

check("eligible-only", "completed and permanent work excluded", () => {
  const input = [
    request("completed", { status: "completed", priority: "urgent" }),
    request("permanent", { permanent: true, priority: "urgent" }),
    request("eligible"),
  ];
  const ids = allocateRetries(input, 20).map((entry) => entry.id);
  assert(equal(ids, ["eligible"]), "ineligible work was selected");
});

check("budget", "selection remains within budget", () => {
  const input = [
    request("urgent", { priority: "urgent", retryCost: 4 }),
    request("normal", { priority: "normal", retryCost: 3 }),
    request("low", { priority: "low", retryCost: 2 }),
  ];
  const selected = allocateRetries(input, 6);
  const cost = selected.reduce((total, entry) => total + entry.retryCost, 0);
  assert(cost <= 6, \`selected cost \${cost} exceeded budget\`);
  assert(equal(selected.map((entry) => entry.id), ["urgent", "low"]), "budget allocation changed");
});

check("skip-expensive", "later affordable work remains selectable", () => {
  const input = [
    request("too-expensive", { priority: "urgent", retryCost: 8 }),
    request("affordable", { priority: "normal", retryCost: 2 }),
  ];
  const ids = allocateRetries(input, 3).map((entry) => entry.id);
  assert(equal(ids, ["affordable"]), "over-budget work blocked an affordable request");
});

check("immutable", "input array remains unchanged", () => {
  const input = [request("normal"), request("urgent", { priority: "urgent" })];
  const before = input.map((entry) => entry.id);
  allocateRetries(input, 10);
  assert(equal(input.map((entry) => entry.id), before), "input array was mutated");
});

check("stable-ties", "exact ties preserve input order", () => {
  const input = [request("first"), request("second"), request("third")];
  const ids = allocateRetries(input, 10).map((entry) => entry.id);
  assert(equal(ids, ["first", "second", "third"]), "tie order changed");
});

check("unique-ids", "duplicate ids collapse to first eligible occurrence", () => {
  const first = request("duplicate", { priority: "low" });
  const later = request("duplicate", { priority: "urgent" });
  const selected = allocateRetries([first, later, request("other")], 10);
  assert(selected.length === 2, "duplicate id remained in allocation");
  assert(selected.includes(first), "first eligible occurrence was not retained");
  assert(!selected.includes(later), "later duplicate occurrence was retained");
});

const passed = checks.filter((result) => result.passed).length;
const result = { passed, total: checks.length, checks };
console.log(\`FORGE_JUDGE_RESULT=\${JSON.stringify(result)}\`);
if (passed !== checks.length) process.exit(1);
`,
} as const;

export const RETRY_BUDGET_MISSION: ForgeMission = {
  id: "retry-budget-v1",
  number: "02",
  title: "Retry Budget Drift",
  brief:
    "The scheduler is retrying every failed request and exhausting its budget. Restore bounded, deterministic allocation.",
  category: "Resource control",
  targetRoot: TARGET_ROOT,
  judgeRoot: JUDGE_ROOT,
  targetFiles,
  judgeFiles,
  judgeCommand: `cd ${TARGET_ROOT} && node ${JUDGE_ROOT}/judge.mjs`,
  testCommand: "node --test",
  artifactPaths: ["src/allocate-retries.mjs", "test/allocate-retries.test.mjs"],
  sourcePath: "src/allocate-retries.mjs",
  candidates: [
    {
      id: "north",
      label: "North",
      strategy: "Minimal patch",
      prompt: `You are Candidate North in a timed patch comparison. Work only in ${TARGET_ROOT}. Fix the retry-budget regression described in README.md using the smallest correct change. Preserve existing behavior, run the visible tests, and leave the patch uncommitted for an external judge. Do not inspect ${JUDGE_ROOT}. Report the files changed and test result.`,
    },
    {
      id: "south",
      label: "South",
      strategy: "Contract-first patch",
      prompt: `You are Candidate South in a timed patch comparison. Work only in ${TARGET_ROOT}. Repair retry allocation by reasoning from every invariant in README.md. Add or adjust visible tests when useful, run them, and leave the patch uncommitted for an external judge. Do not inspect ${JUDGE_ROOT}. Report the files changed and test result.`,
    },
  ],
};
