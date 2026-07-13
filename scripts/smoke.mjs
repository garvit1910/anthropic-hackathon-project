import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3100";
const SHOTS =
  "/private/tmp/claude-501/-Users-garvit-anthropic-hackathon-project/e2b63482-b26a-4eab-88ae-d1775a2dc5a2/scratchpad";

const routes = [
  { path: "/", name: "landing", wait: 4000, canvas: true },
  { path: "/console?case=ANEUX_042", name: "console", wait: 4500, canvas: true },
  { path: "/cases", name: "cases", wait: 1200, canvas: false },
  { path: "/method", name: "method", wait: 1000, canvas: false },
  { path: "/citations", name: "citations", wait: 1000, canvas: false },
  { path: "/about", name: "about", wait: 1000, canvas: false },
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

let totalErrors = 0;
for (const r of routes) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE.ERROR: " + m.text());
  });
  await page.goto(BASE + r.path, { waitUntil: "networkidle" }).catch((e) =>
    errors.push("GOTO: " + e.message)
  );
  await page.waitForTimeout(r.wait);

  let canvasInfo = "";
  if (r.canvas) {
    const c = await page.$("canvas");
    if (c) {
      const box = await c.boundingBox();
      canvasInfo = box ? `canvas ${Math.round(box.width)}x${Math.round(box.height)}` : "canvas (no box)";
    } else {
      canvasInfo = "NO CANVAS";
    }
  }
  await page.screenshot({ path: `${SHOTS}/smoke-${r.name}.png` });
  const filtered = errors.filter(
    (e) => !e.includes("Failed to load resource") || e.includes(".glb") || e.includes(".json")
  );
  totalErrors += filtered.length;
  console.log(`\n### ${r.path}  [${canvasInfo}]`);
  if (filtered.length === 0) console.log("  ✓ no errors");
  else filtered.slice(0, 12).forEach((e) => console.log("  ✗ " + e));
  await page.close();
}

await browser.close();
console.log(`\n=== total errors: ${totalErrors} ===`);
process.exit(totalErrors > 0 ? 1 : 0);
