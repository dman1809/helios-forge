# Routes

The app uses Vite without React Router. It exposes one route.

| URL | Entry | Page | Layout |
| --- | --- | --- | --- |
| `/` | `examples/combined-app/src/client/main.tsx` | `ForgeApp` | self-contained Forge shell |

## Complete Entry Source

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ForgeApp from "./ForgeApp.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ForgeApp />
  </StrictMode>,
);
```

Vite proxies `/api/*` and `/ws` to the Express backend at port 3003. The UI is served at port 5176.
