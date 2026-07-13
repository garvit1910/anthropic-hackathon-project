import { create } from "zustand";
import type {
  ViewerMode,
  MorphologyOverride,
  SpatialAnnotation,
  CatheterPath,
  ToolCallTrace,
  ChatMessage,
  HighlightCommand,
} from "@/types";

/**
 * The single client-side store. Its actions ARE the event bus: the agent's
 * tools (highlight_geometry, perturb_morphology, find_catheter_path, ...) call
 * these actions, and the viewer subscribes to the resulting state. No separate
 * pub/sub — Zustand is the wire.
 */
export interface ConsoleState {
  // --- selection & mode ---
  activeCaseId: string | null;
  mode: ViewerMode;

  // --- what-if ---
  morphologyOverride: MorphologyOverride | null;

  // --- spatial reasoning surfaced by the agent ---
  highlightedElementIds: string[];
  annotations: SpatialAnnotation[];

  // --- overlays ---
  catheterPath: CatheterPath | null;
  streamlinesVisible: boolean;
  wssVisible: boolean;
  /** Context layers (independent of mode): translucent brain hull + vessel graph. */
  brainVisible: boolean;
  graphVisible: boolean;

  // --- chat & agent loop ---
  toolTraces: ToolCallTrace[];
  messages: ChatMessage[];

  // --- reasoning choreography ---
  /** True while the agent is streaming — boosts auto-rotate + camera focus. */
  reasoningActive: boolean;
  /** A question queued by a viewer control (e.g. What-If "re-assess"). The
   *  copilot consumes and clears it, then submits it to the agent. */
  queuedQuestion: string | null;

  // --- demo safety ---
  demoMode: boolean;
  offline: boolean;

  // --- actions (the bus) ---
  setCase: (id: string) => void;
  setMode: (mode: ViewerMode) => void;
  setMorphologyOverride: (patch: Partial<MorphologyOverride>) => void;
  resetMorphology: () => void;
  setHighlights: (ids: string[]) => void;
  clearHighlights: () => void;
  setAnnotations: (annotations: SpatialAnnotation[]) => void;
  clearAnnotations: () => void;
  setCatheterPath: (path: CatheterPath | null) => void;
  setStreamlinesVisible: (v: boolean) => void;
  setWssVisible: (v: boolean) => void;
  setBrainVisible: (v: boolean) => void;
  setGraphVisible: (v: boolean) => void;
  addToolTrace: (trace: ToolCallTrace) => void;
  updateToolTrace: (id: string, patch: Partial<ToolCallTrace>) => void;
  clearToolTraces: () => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setDemoMode: (v: boolean) => void;
  setOffline: (v: boolean) => void;
  setReasoningActive: (v: boolean) => void;
  queueQuestion: (q: string | null) => void;
  /** Convenience: apply a highlight_geometry payload in one shot. */
  applyHighlightCommand: (cmd: HighlightCommand) => void;
  /** Reset per-case transient view state (keeps chat history). */
  resetViewState: () => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  activeCaseId: null,
  mode: "anatomy",
  morphologyOverride: null,
  highlightedElementIds: [],
  annotations: [],
  catheterPath: null,
  streamlinesVisible: false,
  wssVisible: false,
  brainVisible: false,
  graphVisible: false,
  toolTraces: [],
  messages: [],
  reasoningActive: false,
  queuedQuestion: null,
  demoMode: false,
  offline: false,

  setCase: (id) => set({ activeCaseId: id }),
  setMode: (mode) => set({ mode }),
  setMorphologyOverride: (patch) =>
    set((s) => ({
      morphologyOverride: {
        domeSizeMm: patch.domeSizeMm ?? s.morphologyOverride?.domeSizeMm ?? 0,
        neckWidthMm: patch.neckWidthMm ?? s.morphologyOverride?.neckWidthMm ?? 0,
      },
    })),
  resetMorphology: () => set({ morphologyOverride: null }),
  setHighlights: (ids) => set({ highlightedElementIds: ids }),
  clearHighlights: () => set({ highlightedElementIds: [] }),
  setAnnotations: (annotations) => set({ annotations }),
  clearAnnotations: () => set({ annotations: [] }),
  setCatheterPath: (path) => set({ catheterPath: path }),
  setStreamlinesVisible: (v) => set({ streamlinesVisible: v }),
  setWssVisible: (v) => set({ wssVisible: v }),
  setBrainVisible: (v) => set({ brainVisible: v }),
  setGraphVisible: (v) => set({ graphVisible: v }),
  addToolTrace: (trace) => set((s) => ({ toolTraces: [...s.toolTraces, trace] })),
  updateToolTrace: (id, patch) =>
    set((s) => ({
      toolTraces: s.toolTraces.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  clearToolTraces: () => set({ toolTraces: [] }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  setDemoMode: (v) => set({ demoMode: v }),
  setOffline: (v) => set({ offline: v }),
  setReasoningActive: (v) => set({ reasoningActive: v }),
  queueQuestion: (q) => set({ queuedQuestion: q }),

  applyHighlightCommand: (cmd) =>
    set((s) => ({
      highlightedElementIds: cmd.elementIds,
      mode: cmd.mode ?? s.mode,
    })),

  resetViewState: () =>
    set({
      mode: "anatomy",
      morphologyOverride: null,
      highlightedElementIds: [],
      annotations: [],
      catheterPath: null,
      streamlinesVisible: false,
      wssVisible: false,
      brainVisible: false,
      graphVisible: false,
      toolTraces: [],
      reasoningActive: false,
      queuedQuestion: null,
    }),
}));
