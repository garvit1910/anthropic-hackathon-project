/**
 * NeuroVas Copilot interface contract — the fixed boundary between the
 * (offline, Python) pipeline and the (Next.js) web app. The pipeline writes
 * assets that satisfy these shapes; the frontend and the agent tools read
 * them. Treat as stable.
 */
export * from "./viewer";
export * from "./case";
export * from "./morphology";
export * from "./graph";
export * from "./streamlines";
export * from "./wss";
export * from "./catheter";
export * from "./literature";
export * from "./agent";
export * from "./highlight";
