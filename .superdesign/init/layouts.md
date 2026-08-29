# Shared Layouts

## ForgeApp Shell

- Source: `examples/combined-app/src/client/ForgeApp.tsx`
- Route: `/`
- Purpose: single-screen operational shell with sticky header, mission strip, verdict rail, two candidate lanes, and evidence inspector.

The complete render composition is:

```tsx
<div className="forge-shell">
  <header className="topbar">
    <div className="brand-block">brand</div>
    <div className="topbar-state">provenance and phase</div>
    <div className="topbar-actions">mode, primary action, reset or shutdown</div>
  </header>
  <main>
    <section className="mission-strip">mission number, title, brief, metadata</section>
    <section className="verdict-rail">failed, repaired, verified, run ID</section>
    <section className="control-grid">
      <div className="candidate-grid">
        <CandidateLane candidate={state.candidates.north} selected={selected === "north"} />
        <CandidateLane candidate={state.candidates.south} selected={selected === "south"} />
      </div>
      <aside className="evidence-panel">
        <header className="evidence-header">candidate inspector switch</header>
        <div className="evidence-tabs">Diff, Judge, Trace</div>
        <div className="evidence-body">selected evidence view</div>
      </aside>
    </section>
  </main>
</div>
```

The full implementation is under 250 lines and should be passed directly as a context file for design generation. There is no router shell, sidebar, footer, modal layer, or separate navigation component.
