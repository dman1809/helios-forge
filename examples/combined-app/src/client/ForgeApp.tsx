import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Check,
  Circle,
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
import { FORGE_MISSION } from "../shared/forge-mission.ts";
import type {
  ForgeCandidateId,
  ForgeCandidateState,
  ForgePhase,
  ForgeVerdict,
} from "../shared/forge-types.ts";
import { useForgeRun } from "./use-forge-run.ts";
import "./ForgeApp.css";

type EvidenceTab = "diff" | "judge" | "trace";

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

function CandidateLane({ candidate, selected }: { candidate: ForgeCandidateState; selected: boolean }) {
  const judge = candidate.judge;
  return (
    <article className={`candidate-lane lane-${candidate.id} ${selected ? "is-selected" : ""}`}>
      <header className="lane-header">
        <div>
          <div className="lane-kicker">CANDIDATE {candidate.id === "north" ? "01" : "02"}</div>
          <h2>{candidate.label}</h2>
          <p>{candidate.strategy}</p>
        </div>
        <span className={`status-chip status-${candidate.status}`}>
          <StatusIcon status={candidate.status} />
          {candidate.status}
        </span>
      </header>

      <dl className="runtime-grid">
        <div><dt><Server size={13} /> Devbox</dt><dd><ShortId value={candidate.ids?.devboxId} /></dd></div>
        <div><dt><Activity size={13} /> Axon</dt><dd><ShortId value={candidate.ids?.axonId} /></dd></div>
      </dl>

      <div className="lane-score">
        <div>
          <span className="score-value">{judge ? `${judge.passed}/${judge.total}` : "--"}</span>
          <span className="score-label">deterministic checks</span>
        </div>
        {selected && <span className="selected-mark"><Scale size={14} /> selected</span>}
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

function ModeButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button className={active ? "segment active" : "segment"} onClick={onClick}>{children}</button>;
}

export default function ForgeApp() {
  const forge = useForgeRun();
  const { state } = forge;
  const [tab, setTab] = useState<EvidenceTab>("diff");
  const [inspectedCandidate, setInspectedCandidate] = useState<ForgeCandidateId>("north");
  const inspected = state.candidates[inspectedCandidate];
  const selected = state.selectedCandidateId;

  const primary = useMemo(() => {
    if (state.provenance === "replay") {
      return { label: state.phase === "idle" ? "Play replay" : "Replay again", icon: <Play size={16} />, action: forge.playReplay, disabled: forge.busy };
    }
    if (state.phase === "idle") return { label: "Launch live run", icon: <Radio size={16} />, action: forge.startLive, disabled: forge.busy };
    if (state.phase === "competing") return { label: "Run judge", icon: <Scale size={16} />, action: forge.judge, disabled: forge.busy || !forge.readyToJudge };
    if (state.phase === "repairing" && state.verdict === "failed") return { label: "Repairing", icon: <LoaderCircle className="spin" size={16} />, action: () => {}, disabled: true };
    if (state.verdict === "failed" && state.selectedCandidateId) return { label: "Repair winner", icon: <Wrench size={16} />, action: forge.repair, disabled: forge.busy };
    if (state.verdict === "repaired") return { label: "Verify repair", icon: <ShieldCheck size={16} />, action: forge.verify, disabled: forge.busy };
    return { label: PHASE_LABELS[state.phase], icon: <LoaderCircle className={forge.busy ? "spin" : ""} size={16} />, action: () => {}, disabled: true };
  }, [forge, state]);

  const verdictRank = state.verdict === "verified" ? 3 : state.verdict === "repaired" ? 2 : state.verdict === "failed" ? 1 : 0;

  return (
    <div className="forge-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">HF</span>
          <div><strong>HELIOS FORGE</strong><span>MISSION CONTROL</span></div>
        </div>
        <div className="topbar-state">
          <span className={`provenance provenance-${state.provenance}`}>
            {state.provenance === "live" ? <Radio size={12} /> : <Play size={12} />}
            {state.provenance.toUpperCase()}
          </span>
          <span className={`phase phase-${state.phase}`}>{PHASE_LABELS[state.phase]}</span>
        </div>
        <div className="topbar-actions">
          <div className="segmented" aria-label="Run mode">
            <ModeButton active={state.provenance === "replay"} onClick={() => forge.switchMode("replay")}>Replay</ModeButton>
            <ModeButton active={state.provenance === "live"} onClick={() => forge.switchMode("live")}>Live</ModeButton>
          </div>
          <button className="primary-action" disabled={primary.disabled} onClick={primary.action}>
            {primary.icon}{primary.label}
          </button>
          {state.provenance === "live" && state.runId && state.runId !== "provisioning" && (
            <button className="icon-action" title="Shut down Runloop Devboxes" onClick={forge.shutdown} disabled={forge.busy}><Square size={15} /></button>
          )}
          {state.provenance === "replay" && state.phase !== "idle" && (
            <button className="icon-action" title="Reset replay" onClick={() => forge.switchMode("replay")}><RefreshCw size={15} /></button>
          )}
        </div>
      </header>

      <main>
        <section className="mission-strip">
          <div className="mission-number">MISSION 01</div>
          <div className="mission-copy"><h1>{FORGE_MISSION.title}</h1><p>{FORGE_MISSION.brief}</p></div>
          <div className="mission-meta"><span>2 CODEX AGENTS</span><span>2 RUNLOOP DEVBOXES</span><span>1 EXTERNAL JUDGE</span></div>
        </section>

        <section className="verdict-rail" aria-label="Verification pipeline">
          <div className="rail-lead"><GitCompareArrows size={17} /><span>PATCH PIPELINE</span></div>
          {VERDICT_STEPS.map((step, index) => {
            const active = verdictRank >= index + 1;
            const current = state.verdict === step.id;
            return (
              <div className={`rail-step ${active ? "active" : ""} ${current ? "current" : ""}`} key={step.id}>
                <span>{index + 1}</span>{step.label}
              </div>
            );
          })}
          <div className="rail-run"><span>RUN ID</span><ShortId value={state.runId} /></div>
        </section>

        {state.error && <div className="error-banner"><X size={15} /><strong>Run held</strong><span>{state.error}</span></div>}

        <section className="control-grid">
          <div className="candidate-grid">
            <CandidateLane candidate={state.candidates.north} selected={selected === "north"} />
            <CandidateLane candidate={state.candidates.south} selected={selected === "south"} />
          </div>

          <aside className="evidence-panel">
            <header className="evidence-header">
              <div><span>EVIDENCE</span><h2>Inspector</h2></div>
              <div className="candidate-switch">
                <button className={inspectedCandidate === "north" ? "active" : ""} onClick={() => setInspectedCandidate("north")}>N</button>
                <button className={inspectedCandidate === "south" ? "active" : ""} onClick={() => setInspectedCandidate("south")}>S</button>
              </div>
            </header>
            <div className="evidence-tabs" role="tablist">
              <button className={tab === "diff" ? "active" : ""} onClick={() => setTab("diff")}><GitCompareArrows size={14} />Diff</button>
              <button className={tab === "judge" ? "active" : ""} onClick={() => setTab("judge")}><Terminal size={14} />Judge</button>
              <button className={tab === "trace" ? "active" : ""} onClick={() => setTab("trace")}><Activity size={14} />Trace</button>
            </div>
            <div className="evidence-body">
              {tab === "diff" && (
                inspected.artifact?.diff ? <pre className="diff-view">{inspected.artifact.diff}</pre> : <div className="empty-evidence"><GitCompareArrows size={24} /><span>Diff appears after judging</span></div>
              )}
              {tab === "judge" && (
                inspected.judge ? (
                  <div className="judge-view">
                    <div className="command-line"><span>$</span>{FORGE_MISSION.judgeCommand}</div>
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
                  {state.events.length === 0 && <div className="empty-evidence"><Activity size={24} /><span>Event stream idle</span></div>}
                  {state.events.slice().reverse().map((event) => (
                    <div className="trace-row" key={event.id}>
                      <span className={`trace-dot trace-${event.kind}`} />
                      <div><strong>{event.label}</strong><span>{event.detail ?? event.lane}</span></div>
                      <time>{state.provenance === "replay" ? `${(event.at / 1000).toFixed(1)}s` : new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
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
