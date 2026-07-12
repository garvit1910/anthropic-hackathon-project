"use client";

import React from "react";

/**
 * Catches render errors from the WebGL subtree (lost context, a missing GLB
 * that bubbles past Suspense, a bad shader) and shows a static fallback instead
 * of a white screen. The demo never dead-ends on the viewer.
 */
export default class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[VesselViewer] recovered from render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center">
            <div
              className="h-24 w-24 rounded-full blur-md"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(255,77,109,0.55), transparent)",
              }}
            />
            <p className="text-sm text-text-lo">
              3D view unavailable — the renderer lost its context.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs text-accent hover:bg-accent/20"
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
