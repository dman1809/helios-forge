import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Bot,
  Check,
  Circle,
  Download,
  GitCompareArrows,
  LoaderCircle,
  Play,
  Radio,
  RefreshCw,
  Scale,
  Server,
  ShieldCheck,
  Square,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import {
  FORGE_MISSIONS,
  getForgeMission,
} from "../shared/forge-missions.ts";
import type { ForgeMissionId } from "../shared/missions/mission-types.ts";
import type {
  ForgeCandidateId,
  ForgeCandidateState,
  ForgePhase,
  ForgeVerdict,
} from "../shared/forge-types.ts";
import { downloadForgeRunReport } from "./forge-report.ts";
import { useForgeRun } from "./use-forge-run.ts";
import "./ForgeApp.css";

type EvidenceTab = "diff" | "judge" | "trace";
type TraceFilter = "all" | ForgeCandidateId | "judge";
type WorkspaceTarget = "agents" | "devboxes" | "judge";

const PHASE_LABELS: Record<ForgePhase, string> = {
  idle: "Ready",
  provisioning: "Provisioning",
  competing: "Agents working",
  judging: "Judging",
  selected: "Winner selected",
  repairing: "Repairing",
  verified: "Verified",
  error: "Held",
};

const VERDICT_STEPS: Array<{ id: ForgeVerdict; label: string }> = [
  { id: "failed", label: "Failed" },
  { id: "repaired", label: "Repaired" },
  { id: "verified", label: "Verified" },
];

const TRACE_FILTERS: Array<{ id: TraceFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "north", label: "N" },
  { id: "south", label: "S" },
  { id: "judge", label: "Judge" },
];

function ShortId({ value }: { value: string | null | undefined }) {
  return <span className="mono-id">{value ? value.slice(0, 18) : "pending"}</span>;
}

function StatusIcon({ status }: { status: ForgeCandidateState["status"] }) {
  if (status === "verified") return <Check size={14} />;
  if (status === "failed") return <X size={14} />;
  if (["provisioning", "running", "judging", "repairing"].includes(status)) {
    return <LoaderCircle className="spin" size={14} />;
  }
  return <Circle size={12} />;
}

function CandidateLane({
  candidate,
  selected,
}: {
  candidate: ForgeCandidateState;
  selected: boolean;
}) {
  const judge = candidate.judge;
  return (
    <article
      className={`candidate-lane lane-${candidate.id} ${selected ? "is-selected" : ""}`}
    >
      <header className="lane-header">
        <div>
          <div className="lane-kicker">
            CANDIDATE {candidate.id === "north" ? "01" : "02"}
          </div>
          <h2>{candidate.label}</h2>
          <p>{candidate.strategy}</p>
        </div>
        <span className={`status-chip status-${candidate.status}`}>
          <StatusIcon status={candidate.status} />
          {candidate.status}
        </span>
      </header>

      <dl className="runtime-grid">
        <div>
          <dt><Server size={13} /> Devbox</dt>
          <dd><ShortId value={candidate.ids?.devboxId} /></dd>
        </div>
        <div>
          <dt><Activity size={13} /> Axon</dt>
          <dd><ShortId value={candidate.ids?.axonId} /></dd>
        </div>
      </dl>

      <div className="lane-score">
        <div>
          <span className="score-value">
            {judge ? `${judge.passed}/${judge.total}` : "--"}
          </span>
          <span className="score-label">deterministic checks</span>
        </div>
        {selected && (
          <span className="selected-mark"><Scale size={14} /> selected</span>
        )}
      </div>

      <div className="check-list">
        {(judge?.checks ?? []).map((check) => (
          <div className={check.passed ? "check-pass" : "check-fail"} key={check.id}>
            {check.passed ? <Check size={13} /> : <X size={13} />}
            <span>{check.label}</span>
          </div>
        ))}
        {!judge && <p className="lane-empty">Awaiting external judge</p>}
      </div>
    </article>
  );
}

function ModeButton({
  active,
  children,
  disabled,
  onClick,
  title,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      className={active ? "segment active" : "segment"}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

export default function ForgeApp() {
  const forge = useForgeRun();
  const { state } = forge;
  const mission = getForgeMission(state.missionId);
  const [tab, setTab] = useState<EvidenceTab>("diff");
  const [traceFilter, setTraceFilter] = useState<TraceFilter>("all");
  const [inspectedCandidate, setInspectedCandidate] =
    useState<ForgeCandidateId>("north");
  const inspected = state.candidates[inspectedCandidate];
  const selected = state.selectedCandidateId;
  const missionLocked = state.provenance === "live" && state.runId !== null;
  const traceEvents = state.events.filter(
    (event) => traceFilter === "all" || event.lane === traceFilter,
  );

  const primary = useMemo(() => {
    if (state.provenance === "replay") {
      return {
        label: forge.replayAvailable
          ? state.phase === "idle" ? "Play replay" : "Replay again"
          : "Replay unavailable",
        icon: <Play size={16} />,
        action: forge.playReplay,
        disabled: forge.busy || !forge.replayAvailable,
      };
    }
    if (state.phase === "idle") {
      return {
        label: "Launch live run",
        icon: <Radio size={16} />,
        action: forge.startLive,
        disabled: forge.busy,
      };
    }
    if (state.phase === "competing") {
      return {
        label: "Run judge",
        icon: <Scale size={16} />,
        action: forge.judge,
        disabled: forge.busy || !forge.readyToJudge,
      };
    }
    if (state.phase === "repairing" && state.verdict === "failed") {
      return {
        label: "Repairing",
        icon: <LoaderCircle className="spin" size={16} />,
        action: () => {},
        disabled: true,
      };
    }
    if (state.verdict === "failed" && state.selectedCandidateId) {
      return {
        label: "Repair winner",
        icon: <Wrench size={16} />,
        action: forge.repair,
        disabled: forge.busy,
      };
    }
    if (state.verdict === "repaired") {
      return {
        label: "Verify repair",
        icon: <ShieldCheck size={16} />,
        action: forge.verify,
        disabled: forge.busy,
      };
    }
    return {
      label: PHASE_LABELS[state.phase],
      icon: <LoaderCircle className={forge.busy ? "spin" : ""} size={16} />,
      action: () => {},
      disabled: true,
    };
  }, [forge, state]);

  const verdictRank = state.verdict === "verified"
    ? 3
    : state.verdict === "repaired"
      ? 2
      : state.verdict === "failed"
        ? 1
        : 0;

  const focusWorkspace = (target: WorkspaceTarget) => {
    const targetId = target === "judge" ? "evidence-inspector" : "candidate-lanes";
    if (target === "judge") setTab("judge");
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const candidateCount = Object.keys(state.candidates).length;

  return (
    <div className="forge-shell">
      <header className="topbar">
        <div className="brand-block">
          <img
            className="helios-wordmark"
            src={`${import.meta.env.BASE_URL}helios-logo.png`}
            alt="Helios Strategic Innovations"
          />
          <span className="brand-divider" />
          <div className="product-label">
            <strong>FORGE</strong>
            <span>MISSION CONTROL</span>
          </div>
        </div>

        <div className="topbar-state">
          <span className={`connection connection-${forge.connectionStatus}`}>
            <i />
            {forge.connectionStatus}
          </span>
          <span className={`provenance provenance-${state.provenance}`}>
            {state.provenance === "live" ? <Radio size={12} /> : <Play size={12} />}
            {state.provenance.toUpperCase()}
          </span>
          <span className={`phase phase-${state.phase}`}>{PHASE_LABELS[state.phase]}</span>
        </div>

        <div className="topbar-actions">
          <div className="segmented" aria-label="Run mode">
            <ModeButton
              active={state.provenance === "replay"}
              disabled={missionLocked}
              onClick={() => forge.switchMode("replay")}
            >
              Replay
            </ModeButton>
            <ModeButton
              active={state.provenance === "live"}
              disabled={missionLocked || !forge.liveAvailable}
              onClick={() => forge.switchMode("live")}
              title={forge.liveAvailable ? undefined : "Live runs require the local Runloop service"}
            >
              Live
            </ModeButton>
          </div>
          <button
            className="primary-action"
            disabled={primary.disabled}
            onClick={primary.action}
          >
            {primary.icon}{primary.label}
          </button>
          {state.provenance === "live" && state.runId && state.runId !== "provisioning" && (
            <button
              className="icon-action"
              title="Shut down Runloop Devboxes"
              onClick={forge.shutdown}
              disabled={forge.busy}
            >
              <Square size={15} />
            </button>
          )}
          {state.provenance === "replay" && state.phase !== "idle" && (
            <button
              className="icon-action"
              title="Reset replay"
              onClick={() => forge.switchMode("replay")}
            >
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="mission-strip">
          <label className="mission-selector">
            <span>MISSION</span>
            <select
              aria-label="Mission"
              disabled={missionLocked || forge.busy}
              value={state.missionId}
              onChange={(event) => forge.setMission(event.target.value as ForgeMissionId)}
            >
              {Object.values(FORGE_MISSIONS).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} / {item.title}
                </option>
              ))}
            </select>
          </label>
          <div className="mission-copy">
            <div className="mission-number">MISSION {mission.number} · {mission.category}</div>
            <h1>{mission.title}</h1>
            <p>{mission.brief}</p>
          </div>
          <nav className="mission-nav" aria-label="Mission workspace">
            <button
              type="button"
              title="Show agent candidates"
              onClick={() => focusWorkspace("agents")}
            >
              <Bot size={14} />
              <span>Agents</span>
              <strong>{candidateCount}</strong>
            </button>
            <button
              type="button"
              title="Show Runloop Devboxes"
              onClick={() => focusWorkspace("devboxes")}
            >
              <Server size={14} />
              <span>Devboxes</span>
              <strong>{candidateCount}</strong>
            </button>
            <button
              type="button"
              title="Open external judge evidence"
              onClick={() => focusWorkspace("judge")}
            >
              <Scale size={14} />
              <span>Judge</span>
              <strong>1</strong>
            </button>
          </nav>
        </section>

        <section className="verdict-rail" aria-label="Verification pipeline">
          <div className="rail-lead"><GitCompareArrows size={17} /><span>PATCH PIPELINE</span></div>
          <div className="rail-steps">
            {VERDICT_STEPS.map((step, index) => {
              const active = verdictRank >= index + 1;
              const current = state.verdict === step.id;
              return (
                <Fragment key={step.id}>
                  <span
                    className={`rail-step ${active ? "active" : ""} ${current ? "current" : ""}`}
                  >
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                  </span>
                  {index < VERDICT_STEPS.length - 1 && (
                    <span className="rail-connector" aria-hidden="true" />
                  )}
                </Fragment>
              );
            })}
          </div>
          <div className="rail-run"><span>RUN ID</span><ShortId value={state.runId} /></div>
        </section>

        {state.decision && (
          <section className="decision-row" aria-label="Judge decision">
            <div className="decision-primary">
              <span>SELECTED CANDIDATE</span>
              <span className="decision-winner">
                <Scale size={14} />
                <strong>{state.decision.selectedCandidateId === "north" ? "North" : "South"}</strong>
              </span>
            </div>
            <div><span>SCORE N</span><strong>{state.decision.scores.north.passed}/{state.decision.scores.north.total}</strong></div>
            <div><span>SCORE S</span><strong>{state.decision.scores.south.passed}/{state.decision.scores.south.total}</strong></div>
            <div><span>LINES N / S</span><strong>{state.decision.changedLines.north} / {state.decision.changedLines.south}</strong></div>
            <div><span>DECIDED BY</span><strong>{state.decision.decidedBy.replaceAll("-", " ")}</strong></div>
            <div><span>ELAPSED</span><strong>{(state.decision.elapsedMs / 1000).toFixed(1)}s</strong></div>
          </section>
        )}

        {state.error && (
          <div className="error-banner">
            <X size={15} /><strong>Run held</strong><span>{state.error}</span>
          </div>
        )}

        <section className="control-grid">
          <div className="candidate-grid" id="candidate-lanes">
            <CandidateLane
              candidate={state.candidates.north}
              selected={selected === "north"}
            />
            <CandidateLane
              candidate={state.candidates.south}
              selected={selected === "south"}
            />
          </div>

          <aside className="evidence-panel" id="evidence-inspector">
            <header className="evidence-header">
              <div><span>EVIDENCE</span><h2>Inspector</h2></div>
              <div className="evidence-actions">
                <button
                  className="icon-action evidence-download"
                  title="Download evidence JSON"
                  disabled={!state.decision}
                  onClick={() => downloadForgeRunReport(state)}
                >
                  <Download size={15} />
                </button>
                <div className="candidate-switch" aria-label="Inspected candidate">
                  <button
                    className={inspectedCandidate === "north" ? "active" : ""}
                    onClick={() => setInspectedCandidate("north")}
                  >
                    N
                  </button>
                  <button
                    className={inspectedCandidate === "south" ? "active" : ""}
                    onClick={() => setInspectedCandidate("south")}
                  >
                    S
                  </button>
                </div>
              </div>
            </header>
            <div className="evidence-tabs" role="tablist">
              <button className={tab === "diff" ? "active" : ""} onClick={() => setTab("diff")}><GitCompareArrows size={14} />Diff</button>
              <button className={tab === "judge" ? "active" : ""} onClick={() => setTab("judge")}><Terminal size={14} />Judge</button>
              <button className={tab === "trace" ? "active" : ""} onClick={() => setTab("trace")}><Activity size={14} />Trace</button>
            </div>
            <div className="evidence-body">
              {tab === "diff" && (
                inspected.artifact?.diff
                  ? <pre className="diff-view">{inspected.artifact.diff}</pre>
                  : <div className="empty-evidence"><GitCompareArrows size={24} /><span>Diff appears after judging</span></div>
              )}
              {tab === "judge" && (
                inspected.judge ? (
                  <div className="judge-view">
                    <div className="command-line"><span>$</span>{mission.judgeCommand}</div>
                    {inspected.judge.checks.map((check) => (
                      <div className={`judge-row ${check.passed ? "pass" : "fail"}`} key={check.id}>
                        {check.passed ? <Check size={14} /> : <X size={14} />}
                        <div><strong>{check.label}</strong><span>{check.detail}</span></div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-evidence"><Terminal size={24} /><span>No judge output yet</span></div>
              )}
              {tab === "trace" && (
                <div className="trace-view">
                  <div className="trace-filters" aria-label="Trace filter">
                    {TRACE_FILTERS.map((filter) => (
                      <button
                        className={traceFilter === filter.id ? "active" : ""}
                        key={filter.id}
                        onClick={() => setTraceFilter(filter.id)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  {traceEvents.length === 0 && (
                    <div className="empty-evidence"><Activity size={24} /><span>Event stream idle</span></div>
                  )}
                  {traceEvents.slice().reverse().map((event) => (
                    <div className="trace-row" key={event.id}>
                      <span className={`trace-dot trace-${event.kind}`} />
                      <div><strong>{event.label}</strong><span>{event.detail ?? event.lane}</span></div>
                      <time>
                        {state.provenance === "replay"
                          ? `${(event.at / 1000).toFixed(1)}s`
                          : new Date(event.at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
