import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3100";
const SHOTS =
  "/private/tmp/claude-501/-Users-garvit-anthropic-hackathon-project/e2b63482-b26a-4eab-88ae-d1775a2dc5a2/scratchpad";
const browser = await chromium.launch();

// 1) Mobile viewport → should render the poster (NO webgl canvas).
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mobile.newPage();
const mErrs = [];
mp.on("pageerror", (e) => mErrs.push(e.message));
await mp.goto(BASE + "/", { waitUntil: "networkidle" });
await mp.waitForTimeout(2500);
const mCanvas = await mp.$("canvas");
await mp.screenshot({ path: `${SHOTS}/smoke-mobile-landing.png` });
console.log(`mobile / : canvas=${mCanvas ? "PRESENT (unexpected)" : "none (poster ✓)"} errors=${mErrs.length}`);

// 2) Reduced motion → hero still renders a canvas, just frozen.
const rm = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: "reduce",
});
const rp = await rm.newPage();
const rErrs = [];
rp.on("pageerror", (e) => rErrs.push(e.message));
await rp.goto(BASE + "/console?case=CTA_2024_017", { waitUntil: "networkidle" });
await rp.waitForTimeout(3500);
const rCanvas = await rp.$("canvas");
await rp.screenshot({ path: `${SHOTS}/smoke-reduced-console.png` });
console.log(`reduced-motion /console (CTA case): canvas=${rCanvas ? "present ✓" : "MISSING"} errors=${rErrs.length}`);

await browser.close();
