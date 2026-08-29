import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  ForgeCandidateId,
  ForgeEvent,
  ForgeJudgeResponse,
  ForgeProvenance,
  ForgeStartResponse,
} from "../shared/forge-types.ts";
import { api } from "./hooks/api.ts";
import { FORGE_REPLAY_STEPS } from "./forge-replay.ts";
import { createInitialForgeState, forgeReducer } from "./forge-state.ts";

interface TimelineEnvelope {
  type: string;
  agentId?: string;
  step?: string;
  event?: {
    kind?: string;
    eventType?: string;
    axonEvent?: { sequence?: number };
    data?: { params?: { item?: { type?: string; command?: string } } };
  };
}

let eventSequence = 0;

export function useForgeRun() {
  const [state, dispatch] = useReducer(forgeReducer, createInitialForgeState("replay"));
  const [busy, setBusy] = useState(false);
  const [turnCounts, setTurnCounts] = useState<Record<string, number>>({});
  const stateRef = useRef(state);
  const replayTimers = useRef<number[]>([]);
  const seenTimelineEvents = useRef(new Set<string>());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const laneForAgent = useCallback((agentId?: string): ForgeCandidateId | "system" => {
    if (!agentId) return "system";
    const current = stateRef.current;
    if (current.candidates.north.ids?.agentId === agentId) return "north";
    if (current.candidates.south.ids?.agentId === agentId) return "south";
    return "system";
  }, []);

  const addEvent = useCallback(
    (event: Omit<ForgeEvent, "id" | "at"> & { at?: number }) => {
      eventSequence += 1;
      dispatch({
        type: "event_added",
        event: {
          ...event,
          id: `live-${eventSequence}`,
          at: event.at ?? Date.now(),
        },
      });
    },
    [],
  );

  useEffect(() => {
    let stopped = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (stopped) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socket.onopen = () => {
        const run = stateRef.current;
        if (run.provenance !== "live") return;
        for (const candidate of Object.values(run.candidates)) {
          if (candidate.ids?.agentId) {
            void api("/api/subscribe", { agentId: candidate.ids.agentId }).catch(() => {});
          }
        }
      };
      socket.onmessage = (message) => {
        try {
          const envelope = JSON.parse(message.data) as TimelineEnvelope;
          const sequence = envelope.event?.axonEvent?.sequence;
          if (envelope.agentId && sequence !== undefined) {
            const eventKey = `${envelope.agentId}:${sequence}`;
            if (seenTimelineEvents.current.has(eventKey)) return;
            seenTimelineEvents.current.add(eventKey);
          }
        const lane = laneForAgent(envelope.agentId);
        if (envelope.type === "connection_progress" && envelope.step) {
          addEvent({ lane, kind: "runloop", label: envelope.step });
          return;
        }
        if (envelope.type !== "timeline_event" || envelope.event?.kind !== "codex_protocol") {
          return;
        }
        if (envelope.event.eventType === "turn/started") {
          addEvent({ lane, kind: "codex", label: "Codex turn started" });
        }
        if (envelope.event.eventType === "item/completed") {
          const item = envelope.event.data?.params?.item;
          if (item?.type === "commandExecution") {
            addEvent({
              lane,
              kind: "command",
              label: "Command completed",
              detail: item.command?.slice(0, 110),
            });
          }
        }
        if (envelope.event.eventType === "turn/completed" && envelope.agentId) {
          const completedAgentId = envelope.agentId;
          addEvent({ lane, kind: "codex", label: "Patch turn completed" });
          setTurnCounts((current) => {
            const next = {
              ...current,
              [completedAgentId]: (current[completedAgentId] ?? 0) + 1,
            };
            const run = stateRef.current;
            const selected = run.selectedCandidateId;
            if (
              selected &&
              run.phase === "repairing" &&
              run.verdict === "failed" &&
              run.candidates[selected].ids?.agentId === completedAgentId &&
              next[completedAgentId] >= 2
            ) {
              dispatch({ type: "repair_completed", candidateId: selected });
            }
            return next;
          });
        }
        } catch {
          // The generic Runloop stream may include events outside Forge's view model.
        }
      };
      socket.onclose = () => {
        if (!stopped) reconnectTimer = window.setTimeout(connect, 900);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [addEvent, laneForAgent]);

  const clearReplayTimers = useCallback(() => {
    replayTimers.current.forEach((timer) => window.clearTimeout(timer));
    replayTimers.current = [];
  }, []);

  useEffect(() => clearReplayTimers, [clearReplayTimers]);

  const switchMode = useCallback(
    (provenance: ForgeProvenance) => {
      clearReplayTimers();
      setTurnCounts({});
      setBusy(false);
      dispatch({ type: "reset", provenance });
    },
    [clearReplayTimers],
  );

  const playReplay = useCallback(() => {
    clearReplayTimers();
    setBusy(true);
    dispatch({ type: "reset", provenance: "replay" });
    for (const step of FORGE_REPLAY_STEPS) {
      replayTimers.current.push(
        window.setTimeout(() => {
          dispatch(step.action);
          if (step === FORGE_REPLAY_STEPS.at(-1)) setBusy(false);
        }, step.delayMs),
      );
    }
  }, [clearReplayTimers]);

  const startLive = useCallback(async () => {
    setTurnCounts({});
    setBusy(true);
    dispatch({
      type: "run_started",
      runId: "provisioning",
      provenance: "live",
      startedAt: Date.now(),
    });
    try {
      const response = await api<ForgeStartResponse>("/api/forge/start", {});
      dispatch({ type: "run_identified", runId: response.runId });
      dispatch({ type: "candidate_provisioned", candidateId: "north", ids: response.candidates.north });
      dispatch({ type: "candidate_provisioned", candidateId: "south", ids: response.candidates.south });
      addEvent({ lane: "system", kind: "runloop", label: "Parallel workspaces online", detail: response.runId });
    } catch (error) {
      dispatch({ type: "run_failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [addEvent]);

  const judge = useCallback(async () => {
    if (!state.runId) return;
    setBusy(true);
    dispatch({ type: "judge_started" });
    addEvent({ lane: "judge", kind: "command", label: "Deterministic judge started" });
    try {
      const response = await api<ForgeJudgeResponse>("/api/forge/judge", { runId: state.runId });
      for (const candidateId of ["north", "south"] as ForgeCandidateId[]) {
        dispatch({ type: "judge_recorded", candidateId, result: response.results[candidateId] });
        dispatch({ type: "artifact_recorded", candidateId, artifact: response.artifacts[candidateId] });
      }
      dispatch({ type: "candidate_selected", candidateId: response.selectedCandidateId });
      dispatch({ type: "decision_recorded", decision: response.decision });
      addEvent({
        lane: "judge",
        kind: "verdict",
        label: `Candidate ${response.selectedCandidateId === "north" ? "North" : "South"} selected`,
        detail: `${response.results[response.selectedCandidateId].passed} / ${response.results[response.selectedCandidateId].total} checks`,
      });
    } catch (error) {
      dispatch({ type: "run_failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [addEvent, state.runId]);

  const repair = useCallback(async () => {
    if (!state.runId || !state.selectedCandidateId) return;
    setBusy(true);
    dispatch({ type: "repair_started", candidateId: state.selectedCandidateId });
    addEvent({ lane: state.selectedCandidateId, kind: "codex", label: "Repair evidence dispatched" });
    try {
      await api("/api/forge/repair", { runId: state.runId });
    } catch (error) {
      dispatch({ type: "run_failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [addEvent, state.runId, state.selectedCandidateId]);

  const verify = useCallback(async () => {
    if (!state.runId || !state.selectedCandidateId) return;
    setBusy(true);
    addEvent({ lane: "judge", kind: "command", label: "Judge rerun started" });
    try {
      const response = await api<{
        candidateId: ForgeCandidateId;
        result: ForgeJudgeResponse["results"][ForgeCandidateId];
        artifact: ForgeJudgeResponse["artifacts"][ForgeCandidateId];
      }>("/api/forge/verify", { runId: state.runId });
      dispatch({ type: "artifact_recorded", candidateId: response.candidateId, artifact: response.artifact });
      dispatch({ type: "verification_recorded", candidateId: response.candidateId, result: response.result });
      addEvent({
        lane: "judge",
        kind: "verdict",
        label: response.result.exitCode === 0 ? "Patch verified" : "Repair rejected",
        detail: `${response.result.passed} / ${response.result.total} checks`,
      });
    } catch (error) {
      dispatch({ type: "run_failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [addEvent, state.runId, state.selectedCandidateId]);

  const shutdown = useCallback(async () => {
    if (!state.runId) return;
    setBusy(true);
    try {
      await api("/api/forge/shutdown", { runId: state.runId });
      dispatch({ type: "reset", provenance: "live" });
      setTurnCounts({});
    } catch (error) {
      dispatch({ type: "run_failed", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }, [state.runId]);

  const readyToJudge = useMemo(() => {
    const north = state.candidates.north.ids?.agentId;
    const south = state.candidates.south.ids?.agentId;
    return Boolean(north && south && (turnCounts[north] ?? 0) >= 1 && (turnCounts[south] ?? 0) >= 1);
  }, [state.candidates, turnCounts]);

  return {
    state,
    busy,
    readyToJudge,
    switchMode,
    playReplay,
    startLive,
    judge,
    repair,
    verify,
    shutdown,
  };
}
