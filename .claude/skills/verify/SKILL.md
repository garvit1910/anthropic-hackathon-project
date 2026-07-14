# Verify — NeuroVas Copilot (Next.js app)

How to drive this app for runtime verification.

## Launch

- Dev server: `npm run dev` → http://localhost:3000. Check `lsof -nP -iTCP:3000 -sTCP:LISTEN` first — one is usually already running; reuse it.
- Routes: `/` (hero landing), `/upload?case=<id>` (imaging intake), `/console?case=<id>` (3D viewer + copilot), `/cases`, `/about`.

## Drive (Playwright)

- `playwright@1.61` is a project dep with Chromium cached — no install needed.
- Scripts living outside the repo (scratchpad) must import it by absolute path:
  `import { chromium } from "file:///<repo>/node_modules/playwright/index.mjs";`
- The hero "Enter Console" button plays a ~1.25 s WebGL transition before routing —
  it works in headless Chromium (SwiftShader); allow ~8 s for `waitForURL`. At
  viewport width < 768 the poster + 650 ms fade path is used instead (deterministic).
- The console 3D viewer is a same-origin iframe on `/viewer.html` — assert
  `page.locator("iframe")` for "console mounted".

## Gotchas that produce false failures

- framer-motion `AnimatePresence` keeps removed rows in the DOM for the exit
  animation (~200 ms) — wait ≥500 ms before counting elements after a removal.
- After a hard `page.goto`, wait for hydration (element visible + ~500 ms) before
  `setInputFiles`/`dispatchEvent`, or React handlers won't be attached yet.
- Simulated drag-and-drop: build a `DataTransfer` with `page.evaluateHandle(() =>
  { const dt = new DataTransfer(); dt.items.add(new File([...], "name.ext")); return dt; })`
  and `locator.dispatchEvent("drop", { dataTransfer: dt })`.
