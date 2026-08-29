# Theme

## Compact Token Summary

- Framework: React 19 with vanilla global CSS.
- Canvas: `#090b0e`; primary surface: `#101419`; evidence surface: `#0b0e12`.
- Current text: `#edf0f3`; secondary: `#98a2ad`; muted: `#69747f`.
- Current accents: amber `#e0a338`, cyan `#4d99b5`, green `#65d196`, red `#ff817a`.
- Typography: Inter/system sans; resource IDs and system labels use ui-monospace/Consolas.
- Radius: 3-6px. Borders: 1px hairlines. Shadows are nearly absent.
- Header: 64px sticky desktop; stacked and static under 720px.
- Main width: `min(1540px, 100%)`; desktop split `1.45fr / .75fr`; single column below 1100px.
- Candidate lanes: two columns desktop, one column below 720px.
- Breakpoints: 1100px and 720px.

## Approved Replacement Tokens

```css
:root {
  color-scheme: dark;
  --canvas: #0b0b0c;
  --topbar: #0e0f10;
  --surface: #121315;
  --surface-raised: #17181b;
  --border: #2a2c30;
  --border-strong: #5e6167;
  --text: #eceef0;
  --text-secondary: #9da1a7;
  --text-muted: #686c72;
  --silver: #c7c9cd;
  --pass: #66d39a;
  --fail: #f07873;
}
```

## Raw Source

The complete current stylesheet is `examples/combined-app/src/client/ForgeApp.css` (275 lines). It is the sole style source for the target and must be passed in full to Superdesign because it is under the 900-line context threshold.
