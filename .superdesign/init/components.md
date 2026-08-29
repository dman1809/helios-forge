# Shared UI Components

The combined app uses React 19, Lucide React, and page-local TypeScript components rather than a separate component library. The Forge screen's reusable primitives currently live in `examples/combined-app/src/client/ForgeApp.tsx`.

## ShortId

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Props: `value: string | null | undefined`
- Purpose: fixed-width resource identifier display.

```tsx
function ShortId({ value }: { value: string | null | undefined }) {
  return <span className="mono-id">{value ? value.slice(0, 18) : "pending"}</span>;
}
```

## StatusIcon

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Props: `status: ForgeCandidateState["status"]`
- Purpose: semantic candidate lifecycle icon.

```tsx
function StatusIcon({ status }: { status: ForgeCandidateState["status"] }) {
  if (status === "verified") return <Check size={14} />;
  if (status === "failed") return <X size={14} />;
  if (["provisioning", "running", "judging", "repairing"].includes(status)) {
    return <LoaderCircle className="spin" size={14} />;
  }
  return <Circle size={12} />;
}
```

## ModeButton

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Props: `active`, `children`, `onClick`
- Purpose: segmented mode control.

```tsx
function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "segment active" : "segment"} onClick={onClick}>
      {children}
    </button>
  );
}
```

## CandidateLane

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Props: `candidate: ForgeCandidateState`, `selected: boolean`
- Purpose: repeated candidate result lane with runtime IDs, score, and judge checks.

```tsx
function CandidateLane({
  candidate,
  selected,
}: {
  candidate: ForgeCandidateState;
  selected: boolean;
}) {
  const judge = candidate.judge;
  return (
    <article className={`candidate-lane lane-${candidate.id} ${selected ? "is-selected" : ""}`}>
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
```
