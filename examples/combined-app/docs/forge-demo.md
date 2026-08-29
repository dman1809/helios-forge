# Helios Forge Demo Runbook

## What the audience sees

Helios Forge runs a selected bounded software mission through two independent
Codex candidates in separate Runloop Devboxes. A deterministic judge selects a
winner, reveals only failed-check evidence, permits at most one repair turn, and
verifies the result. The console preserves decision, diff, judge, and filtered
trace evidence throughout.

## Before doors open

1. Confirm the `axon-agents` Runloop blueprint exists and includes the Codex CLI.
2. Provide `RUNLOOP_API_KEY` and either `CODEX_AUTH_JSON` or `OPENAI_API_KEY` to
   the server process. Never place live credentials in tracked files.
3. From the repository root, install and build once:

   ```bash
   bun install
   bun run build
   ```

4. From `examples/combined-app`, start the console:

   ```bash
   bun run dev
   ```

5. Open `http://localhost:5176` and play the Incident Dispatch replay once.
   Confirm `REPLAY`, `VERIFIED`, and `6 / 6` are visible. Select Retry Budget and
   confirm its replay control says `Replay unavailable`.

## Five-minute stage path

1. **Frame, 20 seconds:** "Two agents get the same production regression in
   isolated cloud workspaces. They cannot see the hidden judge."
2. **Select:** choose Incident Dispatch or Retry Budget before launch. Point out
   the `Connected` transport status and the explicit `REPLAY` or `LIVE` badge.
3. **Launch:** switch to `LIVE` and select **Launch live run**. Point out the two
   Runloop Devbox and Axon identifiers as they appear.
4. **Compete:** let both candidate lanes stream. Explain that visible tests are
   necessary but not sufficient.
5. **Judge:** select **Run judge**. Both candidates are scored by the same
   mission-specific deterministic checks; ties resolve by exit code, then
   smaller diff churn, then candidate ID. Read the authoritative decision band:
   selected candidate, original scores, changed lines, deciding field, and time.
6. **Repair when needed:** select **Repair winner** only when the selected patch
   failed a check. Only failed-check evidence is returned. Then select
   **Verify repair**. A winner that already passes every check verifies directly.
7. **Inspect:** show Diff, Judge, and Trace. Use All, N, S, and Judge filters, then
   use **Download evidence JSON** to demonstrate the sanitized versioned report.
8. **Close:** select **Shut down Runloop Devboxes** and confirm the console returns
   to Ready and `/api/agents` reports an empty list.

## Recovery

- If venue connectivity is unstable, switch to Replay and select **Play replay**.
  Replay uses identifiers and patch evidence captured from a genuine live run,
  but never claims to be live.
- If a live run errors, shut down its Devboxes before retrying. Do not repeatedly
  provision while the failure cause is unknown.
- Keep Replay available even after a successful rehearsal; it is the reliable
  stage fallback.

## Current proof

The recorded replay is based on live Runloop run `7791fa62-d60`: both candidates
initially scored 5/6, North won the deterministic tie break, the judge exposed the
duplicate-ID failure, and one repair turn verified 6/6.

Retry Budget was rehearsed live in Runloop run `5871cd36-e8c`. Both candidates
passed 7/7 hidden checks on their first judged patches; North won the
changed-lines tie break, 20 to 106. Both Devboxes were shut down and
`/api/agents` returned an empty list. No Retry Budget replay was captured because
the run did not produce the required failed-and-repaired chronology; the UI
therefore continues to report `Replay unavailable` for Mission 02.
