# Helios Forge Demo Runbook

## What the audience sees

Helios Forge runs the same bounded software mission through two independent
Codex candidates in separate Runloop Devboxes. A deterministic judge selects a
winner, reveals only failed-check evidence, permits one repair turn, and verifies
the result. Diff, judge, and trace evidence remain visible throughout.

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

5. Open `http://localhost:5176` and play the replay once. Confirm `REPLAY`,
   `VERIFIED`, and `6 / 6` are visible.

## Five-minute stage path

1. **Frame, 20 seconds:** "Two agents get the same production regression in
   isolated cloud workspaces. They cannot see the hidden judge."
2. **Launch:** switch to `LIVE` and select **Launch live run**. Point out the two
   Runloop Devbox and Axon identifiers as they appear.
3. **Compete:** let both candidate lanes stream. Explain that visible tests are
   necessary but not sufficient.
4. **Judge:** select **Run external judge**. Both candidates should be scored by
   the same six deterministic checks; ties resolve by exit code, then smaller
   diff churn, then candidate ID.
5. **Repair:** select **Repair winner**. Only the failed-check evidence is sent
   back to the selected candidate.
6. **Verify:** select **Verify repair**. Stop on the `6 / 6` verified state and
   show the Diff, Judge, and Trace tabs.
7. **Close:** select **Shut down Runloop Devboxes** and confirm the console returns
   to Ready.

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
