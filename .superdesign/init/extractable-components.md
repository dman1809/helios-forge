# Extractable Components

## ForgeTopbar

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Category: layout
- Description: Brand, provenance, connection/phase state, run mode, and lifecycle controls.
- Extractable props: `provenance`, `phase`, `connectionState`, `busy`, `primaryAction`.
- Hardcoded: logo asset, Forge product label, Lucide icon choices, mode labels.

## CandidateLane

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Category: basic
- Description: Repeated candidate identity, resource IDs, score, and deterministic check list.
- Extractable props: `candidate`, `selected`.
- Hardcoded: Candidate numbering, Devbox/Axon labels, semantic icons.

## VerdictRail

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Category: basic
- Description: Three-step failed, repaired, verified pipeline with run ID.
- Extractable props: `verdict`, `runId`.
- Hardcoded: three lifecycle labels and GitCompareArrows icon.

## EvidenceInspector

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Category: basic
- Description: Candidate switch with Diff, Judge, and Trace tabs.
- Extractable props: `candidateId`, `tab`, `artifact`, `judge`, `events`, `traceFilter`.
- Hardcoded: tab labels and Lucide icon choices.

## ModeButton

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Category: basic
- Description: Compact button inside the Replay/Live segmented control.
- Extractable props: `active`, `children`, `onClick`.
- Hardcoded: segment class names.
