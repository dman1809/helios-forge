# Page Dependency Trees

## `/` Mission Control

Entry: `examples/combined-app/src/client/main.tsx`

Dependencies:

- `examples/combined-app/src/client/ForgeApp.tsx`
  - `examples/combined-app/src/client/ForgeApp.css`
  - `examples/combined-app/src/client/use-forge-run.ts`
    - `examples/combined-app/src/client/forge-state.ts`
    - `examples/combined-app/src/client/forge-replay.ts`
    - `examples/combined-app/src/client/hooks/api.ts`
    - `examples/combined-app/src/shared/forge-types.ts`
  - `examples/combined-app/src/shared/forge-mission.ts`
  - `examples/combined-app/src/shared/forge-types.ts`
  - `lucide-react`

The actual desktop render is the default branch in `ForgeApp.tsx`. Responsive behavior is CSS-only; there is no alternate React mobile branch.
