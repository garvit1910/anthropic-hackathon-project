"use client";

/**
 * EvidenceGraph — the interrogable literature-evidence constellation.
 *
 * A new view over a turn's `message.sources`: the patient at center, retrieved
 * sources orbiting, colored by WSS stance, with contested opposing sources
 * joined by a "tension tether" that visibly tugs apart. Hover reads a source;
 * click opens its passage AND echoes to the 3D viewer (topic → geometry). An
 * expand button promotes the graph to a full-console overlay for interrogation.
 *
 * Pure geometry lives in ./evidenceGraph; this file is presentation only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Citation } from "@/lib/agent/types";
import { getCase } from "@/lib/cases";
import { postToViewer } from "./viewerBridge";
import {
  layoutEvidence,
  stanceColor,
  directionColor,
  relevancePct,
  type EvidenceLayout,
  type EvidenceNode,
} from "./evidenceLayout";

const SIZES = {
  inline: { width: 340, height: 288 },
  overlay: { width: 640, height: 560 },
} as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const dirGlyph = (d: EvidenceNode["direction"]) => (d === "up" ? "↑" : d === "down" ? "↓" : "");

// ── one source node (entrance fade + contested tug) ───────────────────────────

function NodeGroup({
  node,
  index,
  tugging,
  amp,
  dim,
  active,
  reduced,
  onHover,
  onSelect,
}: {
  node: EvidenceNode;
  index: number;
  tugging: boolean;
  amp: number;
  dim: boolean;
  active: boolean;
  reduced: boolean;
  onHover: (id: string | null) => void;
  onSelect: (n: EvidenceNode) => void;
}) {
  const color = stanceColor(node.source.stance);
  const ux = Math.cos(node.angle) * amp;
  const uy = Math.sin(node.angle) * amp;
  // Contested nodes strain outward along their radius — since the pair sits on
  // opposite poles, "outward" is literally opposite directions (the tug).
  const tug =
    tugging && !reduced
      ? { animate: { x: [0, ux, 0], y: [0, uy, 0] }, transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const } }
      : {};
  const opacity = dim ? 0.34 : 1;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
    >
      <motion.g {...tug}>
        {/* contested halo */}
        {node.source.contested && (
          <circle cx={node.x} cy={node.y} r={node.r + 5} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.55} strokeDasharray="2 3" />
        )}
        {/* cited-in-verdict ring */}
        {node.cited && (
          <circle cx={node.x} cy={node.y} r={node.r + 2.5} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeOpacity={0.9} />
        )}
        {/* body */}
        <circle cx={node.x} cy={node.y} r={node.r} fill={color} fillOpacity={active ? 0.95 : 0.82} stroke={color} strokeWidth={active ? 2 : 1} style={{ pointerEvents: "none" }} />
        {/* direction glyph */}
        {dirGlyph(node.direction) && (
          <text x={node.x} y={node.y - node.r - 4} textAnchor="middle" fontSize={11} fill={color} style={{ pointerEvents: "none", fontFamily: "var(--font-mono)" }}>
            {dirGlyph(node.direction)}
          </text>
        )}
        {/* hit target */}
        <circle
          cx={node.x}
          cy={node.y}
          r={node.r + 9}
          fill="transparent"
          role="button"
          tabIndex={0}
          aria-label={`${node.source.title} — ${relevancePct(node.source.relevanceScore)} match${node.source.contested ? ", contested" : ""}`}
          style={{ cursor: "pointer", outline: "none" }}
          onMouseEnter={() => onHover(node.source.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSelect(node)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(node);
            }
          }}
        />
      </motion.g>
    </motion.g>
  );
}

// ── the SVG constellation (shared by inline + overlay) ────────────────────────

function Constellation({
  layout,
  patientLabel,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  reduced,
  large,
}: {
  layout: EvidenceLayout;
  patientLabel: string;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (n: EvidenceNode) => void;
  reduced: boolean;
  large: boolean;
}) {
  const hasCited = layout.nodes.some((n) => n.cited);
  const amp = large ? 6 : 3.5;
  const tetherIds = new Set(layout.tethers.flatMap((t) => [t.a.source.id, t.b.source.id]));

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label="Literature evidence graph: patient at center, sources orbiting, colored by wall-shear-stress stance"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null as unknown as EvidenceNode);
      }}
    >
      {/* patient→source edges */}
      {layout.nodes.map((n) => {
        const active = n.source.id === selectedId || n.source.id === hoveredId;
        const dim = hasCited && !n.cited;
        const rel = clamp01(n.source.relevanceScore);
        return (
          <line
            key={`e-${n.source.id}`}
            x1={layout.cx}
            y1={layout.cy}
            x2={n.x}
            y2={n.y}
            stroke={directionColor(n.direction)}
            strokeWidth={0.7 + 2.3 * rel}
            strokeOpacity={dim ? 0.1 : active ? 0.65 : 0.32}
          />
        );
      })}

      {/* contested tension tethers */}
      {layout.tethers.map((t, i) => {
        const stroke = "var(--wss-high)";
        if (reduced) {
          return <line key={`t-${i}`} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke={stroke} strokeWidth={1.2} strokeOpacity={0.5} strokeDasharray="4 4" />;
        }
        const ax = Math.cos(t.a.angle) * amp;
        const ay = Math.sin(t.a.angle) * amp;
        const bx = Math.cos(t.b.angle) * amp;
        const by = Math.sin(t.b.angle) * amp;
        return (
          <motion.line
            key={`t-${i}`}
            stroke={stroke}
            strokeWidth={1.2}
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            initial={{ x1: t.a.x, y1: t.a.y, x2: t.b.x, y2: t.b.y }}
            animate={{ x1: [t.a.x, t.a.x + ax, t.a.x], y1: [t.a.y, t.a.y + ay, t.a.y], x2: [t.b.x, t.b.x + bx, t.b.x], y2: [t.b.y, t.b.y + by, t.b.y] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}

      {/* patient center node */}
      <g>
        <circle cx={layout.cx} cy={layout.cy} r={layout.patientR + 4} fill="var(--accent)" fillOpacity={0.12} />
        <circle cx={layout.cx} cy={layout.cy} r={layout.patientR} fill="var(--accent)" fillOpacity={0.9} stroke="var(--accent)" strokeWidth={1.5} />
        <text x={layout.cx} y={layout.cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={large ? 11 : 9} fill="var(--bg-deep)" style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
          PATIENT
        </text>
        <text x={layout.cx} y={layout.cy + layout.patientR + 13} textAnchor="middle" fontSize={large ? 11 : 9} fill="var(--text-lo)" style={{ fontFamily: "var(--font-mono)" }}>
          {patientLabel.length > 34 ? patientLabel.slice(0, 33) + "…" : patientLabel}
        </text>
      </g>

      {/* source nodes */}
      {layout.nodes.map((n, i) => (
        <NodeGroup
          key={n.source.id}
          node={n}
          index={i}
          tugging={tetherIds.has(n.source.id)}
          amp={amp}
          dim={hasCited && !n.cited}
          active={n.source.id === selectedId || n.source.id === hoveredId}
          reduced={reduced}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}

// ── readouts ──────────────────────────────────────────────────────────────────

function Badges({ source }: { source: Citation }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {source.contested && <span className="num rounded-sm bg-wss-high/15 px-1 text-[9px] text-wss-high">contested</span>}
      {source.stance !== "neutral" && (
        <span className="num rounded-sm px-1 text-[9px]" style={{ color: stanceColor(source.stance), background: "color-mix(in srgb, currentColor 14%, transparent)" }}>
          {source.stance}
        </span>
      )}
      <span className="num text-[9px] text-text-lo">{source.topic}</span>
      <span className="num text-[9px] text-text-lo">· {relevancePct(source.relevanceScore)} match</span>
      {source.direction && <span className="num text-[9px] text-text-lo">· {source.direction}</span>}
    </div>
  );
}

function SourceDetail({ source, onClose }: { source: Citation; onClose: () => void }) {
  return (
    <div className="panel rounded-md p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="num text-[10px] text-accent">{source.id}</span>
        <button onClick={onClose} className="num text-[11px] leading-none text-text-lo hover:text-text-hi" aria-label="Close source detail">
          ✕
        </button>
      </div>
      <div className="mt-1 text-[12px] font-semibold leading-snug text-text-hi">{source.title}</div>
      <div className="num mt-0.5 text-[10px] text-text-lo">
        {source.citation}
        {source.year ? ` · ${source.year}` : ""}
      </div>
      <Badges source={source} />
      <p className="mt-2 border-t border-white/5 pt-2 text-[11.5px] leading-relaxed text-text-lo/90">{source.passage}</p>
      <div className="num mt-2 text-[9px] text-text-lo/70">echoed to 3D · {source.topic}</div>
    </div>
  );
}

function HoverReadout({ source }: { source: Citation }) {
  return (
    <div className="text-[11px] leading-snug text-text-lo">
      <span className="text-text-hi">{source.title}</span>
      <span className="num"> · {source.citation}</span>
      <Badges source={source} />
    </div>
  );
}

function Legend() {
  const item = (color: string, label: string) => (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
  return (
    <div className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-text-lo">
      {item("var(--wss-high)", "high-WSS")}
      {item("var(--wss-low)", "low-WSS")}
      {item("var(--text-lo)", "neutral")}
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full border border-dashed border-wss-high" />
        contested
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full border border-accent" />
        cited
      </span>
      <span>closer = more relevant</span>
    </div>
  );
}

function EvidenceList({
  sources,
  citationIds,
  onSelect,
}: {
  sources: Citation[];
  citationIds: string[];
  onSelect: (s: Citation) => void;
}) {
  const cites = new Set(citationIds);
  return (
    <ul className="space-y-1">
      {sources.map((s) => (
        <li key={s.id}>
          <button onClick={() => onSelect(s)} className="w-full rounded border border-white/6 bg-white/[0.02] px-2 py-1 text-left hover:border-white/12">
            <div className="flex items-center gap-1.5">
              <span className="num text-[10px]" style={{ color: stanceColor(s.stance) }}>
                {s.id}
              </span>
              {cites.has(s.id) && <span className="num rounded-sm bg-accent/15 px-1 text-[9px] text-accent">cited</span>}
              {s.contested && <span className="num rounded-sm bg-wss-high/15 px-1 text-[9px] text-wss-high">contested</span>}
              <span className="num ml-auto text-[9px] text-text-lo">{relevancePct(s.relevanceScore)}</span>
            </div>
            <div className="mt-0.5 text-[10.5px] leading-snug text-text-lo">{s.title}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function EvidenceGraph({
  sources,
  citationIds,
  caseId,
}: {
  sources: Citation[];
  citationIds: string[];
  caseId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const reduced = useReducedMotion() ?? false;

  const patientLabel = getCase(caseId).label;
  const citeKey = citationIds.join(",");

  const inlineLayout = useMemo(() => layoutEvidence(sources, SIZES.inline, citationIds), [sources, citeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const overlayLayout = useMemo(() => layoutEvidence(sources, SIZES.overlay, citationIds), [sources, citeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => sources.find((s) => s.id === selectedId) ?? null, [sources, selectedId]);
  const hovered = useMemo(() => sources.find((s) => s.id === hoveredId) ?? null, [sources, hoveredId]);

  const onSelect = useCallback((n: EvidenceNode | null) => {
    if (!n) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev === n.source.id ? null : n.source.id));
    postToViewer({ type: "highlightEvidence", topic: n.source.topic });
  }, []);

  const onSelectSource = useCallback((s: Citation) => {
    setSelectedId((prev) => (prev === s.id ? null : s.id));
    postToViewer({ type: "highlightEvidence", topic: s.topic });
  }, []);

  // Esc closes the overlay.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!sources.length) return null;

  const contestedCount = sources.filter((s) => s.contested).length;
  const inTension = inlineLayout.tethers.length > 0;
  const summary = `${sources.length} source${sources.length === 1 ? "" : "s"}${contestedCount ? ` · ${contestedCount} contested` : ""}${inTension ? " · WSS in tension" : ""}`;

  return (
    <div className="glass rounded-lg p-3">
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="num text-[10px] uppercase tracking-widest text-text-lo">Evidence graph</div>
          <div className="num text-[10px] text-text-lo/80">{summary}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowList((v) => !v)}
            className="num rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-text-lo hover:text-text-hi"
          >
            {showList ? "graph" : "list"}
          </button>
          <button
            onClick={() => setExpanded(true)}
            className="num rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-text-lo hover:text-text-hi"
            aria-label="Expand evidence graph"
          >
            ⤢ expand
          </button>
        </div>
      </div>

      {/* body */}
      <div className="mt-2">
        {showList ? (
          <EvidenceList sources={sources} citationIds={citationIds} onSelect={onSelectSource} />
        ) : (
          <Constellation
            layout={inlineLayout}
            patientLabel={patientLabel}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={onSelect}
            reduced={reduced}
            large={false}
          />
        )}
      </div>

      {/* readout */}
      <div className="mt-2 border-t border-white/5 pt-2">
        {selected ? (
          <SourceDetail source={selected} onClose={() => setSelectedId(null)} />
        ) : hovered ? (
          <HoverReadout source={hovered} />
        ) : (
          <Legend />
        )}
      </div>

      {/* overlay */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {expanded && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setExpanded(false)}
              >
                <motion.div
                  className="glass flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl md:flex-row"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="min-w-0 flex-1 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <div className="display text-[13px] font-semibold text-text-hi">Literature-evidence graph</div>
                        <div className="num text-[10px] text-text-lo">{summary} · click a source to read it</div>
                      </div>
                      <button onClick={() => setExpanded(false)} className="num rounded border border-white/10 px-2 py-0.5 text-[10px] text-text-lo hover:text-text-hi">
                        ✕ close
                      </button>
                    </div>
                    <Constellation
                      layout={overlayLayout}
                      patientLabel={patientLabel}
                      selectedId={selectedId}
                      hoveredId={hoveredId}
                      onHover={setHoveredId}
                      onSelect={onSelect}
                      reduced={reduced}
                      large
                    />
                    <div className="mt-2">
                      <Legend />
                    </div>
                  </div>
                  <div className="w-full shrink-0 overflow-y-auto border-t border-hairline p-4 md:max-h-[90vh] md:w-80 md:border-l md:border-t-0">
                    {selected ? (
                      <SourceDetail source={selected} onClose={() => setSelectedId(null)} />
                    ) : (
                      <div className="text-[12px] leading-relaxed text-text-lo">
                        Each node is a retrieved source, colored by its wall-shear-stress stance and sized by relevance to this
                        patient. Contested sources are joined by a tension tether — the high-WSS vs low-WSS controversy made
                        visible. <span className="text-text-hi">Click a node</span> to read its passage; the 3D model highlights
                        the matching geometry.
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
