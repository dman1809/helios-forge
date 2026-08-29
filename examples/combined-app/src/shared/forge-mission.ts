const TARGET_ROOT = "/home/user/forge-target";
const JUDGE_ROOT = "/home/user/forge-judge";

const targetFiles = {
  ".gitignore": ".forge-artifacts/\n",
  "README.md": `# Incident Dispatch Queue

The queue ranks active incidents for operator dispatch.

## Contract

- Expired incidents are excluded. An incident expiring exactly at \`now\` is expired.
- Severity order is critical, warning, then info.
- Within a severity, older incidents come first.
- Exact ties retain their input order.
- Ranking never mutates the caller's array.

Run the visible suite with \`node --test\`.
`,
  "package.json": `{
  "name": "incident-dispatch-queue",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
`,
  "src/rank-incidents.mjs": `const severityWeight = {
  critical: 3,
  warning: 2,
  info: 1,
};

export function rankIncidents(incidents, _now) {
  return incidents.sort(
    (left, right) =>
      severityWeight[right.severity] - severityWeight[left.severity] ||
      left.createdAt - right.createdAt,
  );
}
`,
  "test/rank-incidents.test.mjs": `import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { rankIncidents } from "../src/rank-incidents.mjs";

describe("rankIncidents", () => {
  test("ranks severity before age", () => {
    const incidents = [
      { id: "old-info", severity: "info", createdAt: 1, expiresAt: null },
      { id: "new-critical", severity: "critical", createdAt: 9, expiresAt: null },
      { id: "old-warning", severity: "warning", createdAt: 2, expiresAt: null },
    ];

    assert.deepEqual(rankIncidents(incidents, 10).map((incident) => incident.id), [
      "new-critical",
      "old-warning",
      "old-info",
    ]);
  });

  test("ranks older incidents first within a severity", () => {
    const incidents = [
      { id: "new", severity: "warning", createdAt: 8, expiresAt: null },
      { id: "old", severity: "warning", createdAt: 3, expiresAt: null },
    ];

    assert.deepEqual(rankIncidents(incidents, 10).map((incident) => incident.id), [
      "old",
      "new",
    ]);
  });
});
`,
} as const;

const judgeFiles = {
  "judge.mjs": `import { rankIncidents } from "../forge-target/src/rank-incidents.mjs";

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

const now = 100;

check("ordering", "severity and age ordering", () => {
  const input = [
    { id: "info", severity: "info", createdAt: 1, expiresAt: null },
    { id: "warning-new", severity: "warning", createdAt: 9, expiresAt: 200 },
    { id: "critical", severity: "critical", createdAt: 8, expiresAt: 200 },
    { id: "warning-old", severity: "warning", createdAt: 2, expiresAt: 200 },
  ];
  const ids = rankIncidents(input, now).map((incident) => incident.id);
  assert(equal(ids, ["critical", "warning-old", "warning-new", "info"]), "ordering changed");
});

check("active-only", "expired incidents excluded", () => {
  const input = [
    { id: "expired-critical", severity: "critical", createdAt: 1, expiresAt: 99 },
    { id: "active-warning", severity: "warning", createdAt: 2, expiresAt: 101 },
  ];
  const ids = rankIncidents(input, now).map((incident) => incident.id);
  assert(equal(ids, ["active-warning"]), "expired incident remained in queue");
});

check("boundary", "expiry boundary is exclusive", () => {
  const input = [
    { id: "boundary", severity: "critical", createdAt: 1, expiresAt: now },
    { id: "future", severity: "info", createdAt: 2, expiresAt: now + 1 },
  ];
  const ids = rankIncidents(input, now).map((incident) => incident.id);
  assert(equal(ids, ["future"]), "expiresAt === now must be excluded");
});

check("immutable", "input array remains unchanged", () => {
  const input = [
    { id: "info", severity: "info", createdAt: 1, expiresAt: null },
    { id: "critical", severity: "critical", createdAt: 2, expiresAt: null },
  ];
  const before = input.map((incident) => incident.id);
  rankIncidents(input, now);
  assert(equal(input.map((incident) => incident.id), before), "input array was mutated");
});

check("stable-ties", "exact ties preserve input order", () => {
  const input = [
    { id: "first", severity: "warning", createdAt: 4, expiresAt: null },
    { id: "second", severity: "warning", createdAt: 4, expiresAt: null },
    { id: "third", severity: "warning", createdAt: 4, expiresAt: null },
  ];
  const ids = rankIncidents(input, now).map((incident) => incident.id);
  assert(equal(ids, ["first", "second", "third"]), "tie order changed");
});

check("unique-ids", "duplicate ids collapse to the first active occurrence", () => {
  const first = { id: "duplicate", severity: "warning", createdAt: 4, expiresAt: null };
  const duplicate = { id: "duplicate", severity: "critical", createdAt: 1, expiresAt: null };
  const other = { id: "other", severity: "info", createdAt: 2, expiresAt: null };
  const ranked = rankIncidents([first, duplicate, other], now);
  assert(ranked.length === 2, "duplicate id remained in queue");
  assert(ranked.includes(first), "first active occurrence was not retained");
  assert(!ranked.includes(duplicate), "later duplicate occurrence was retained");
});

const passed = checks.filter((result) => result.passed).length;
const result = { passed, total: checks.length, checks };
console.log(\`FORGE_JUDGE_RESULT=\${JSON.stringify(result)}\`);
if (passed !== checks.length) process.exit(1);
`,
} as const;

export const FORGE_MISSION = {
  id: "incident-dispatch-v1",
  title: "Incident Dispatch Regression",
  brief:
    "Expired incidents are surfacing ahead of active work. Repair ranking without breaking the documented queue contract.",
  targetRoot: TARGET_ROOT,
  judgeRoot: JUDGE_ROOT,
  targetFiles,
  judgeFiles,
  judgeCommand: `cd ${TARGET_ROOT} && node ${JUDGE_ROOT}/judge.mjs`,
  candidates: [
    {
      id: "north",
      label: "North",
      strategy: "Minimal patch",
      prompt: `You are Candidate North in a timed patch comparison. Work only in ${TARGET_ROOT}. Fix the expired-incident regression described in README.md using the smallest correct change. Preserve existing behavior, run the visible tests, and leave the patch uncommitted for an external judge. Do not inspect ${JUDGE_ROOT}. Report the files changed and test result.`,
    },
    {
      id: "south",
      label: "South",
      strategy: "Contract-first patch",
      prompt: `You are Candidate South in a timed patch comparison. Work only in ${TARGET_ROOT}. Repair the incident-ranking regression by reasoning from every invariant in README.md. Add or adjust visible tests when useful, run them, and leave the patch uncommitted for an external judge. Do not inspect ${JUDGE_ROOT}. Report the files changed and test result.`,
    },
  ],
} as const;

function encodeFileCommand(root: string, path: string, source: string): string {
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return `printf '%s' '${encoded}' | base64 -d > '${root}/${path}'`;
}

export function buildSeedLaunchCommands(): string[] {
  const commands = [
    `mkdir -p '${TARGET_ROOT}/src' '${TARGET_ROOT}/test' '${JUDGE_ROOT}'`,
  ];

  for (const [path, source] of Object.entries(targetFiles)) {
    commands.push(encodeFileCommand(TARGET_ROOT, path, source));
  }
  for (const [path, source] of Object.entries(judgeFiles)) {
    commands.push(encodeFileCommand(JUDGE_ROOT, path, source));
  }

  commands.push(
    `cd '${TARGET_ROOT}' && git init -q && git config user.email 'forge@localhost' && git config user.name 'Helios Forge' && git add . && git commit -qm 'seed mission'`,
    `cd '${TARGET_ROOT}' && node --test`,
  );
  return commands;
}
