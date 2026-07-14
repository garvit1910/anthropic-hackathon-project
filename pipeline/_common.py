"""
_common.py — shared pipeline helpers.

Key design choice (per the build bible: "inspect, don't assume"): we DISCOVER which file in a
case folder is the surface mesh vs. the centerline by inspecting the geometry, instead of
hard-coding Aneurisk's filenames. Aneurisk's exact layout varies by mirror; this adapts to it.
"""

from __future__ import annotations

import glob
import os

RADIUS_ARRAY_NAMES = ("MaximumInscribedSphereRadius", "Radius", "radius", "MISR")
MESH_EXTS = ("*.vtp", "*.vtk", "*.stl", "*.ply", "*.obj")


def find_meshes(case_dir: str) -> list[str]:
    files: list[str] = []
    for ext in MESH_EXTS:
        files += glob.glob(os.path.join(case_dir, "**", ext), recursive=True)
    return sorted(set(files))


def classify_mesh(path: str) -> str:
    """Return 'centerline' | 'surface' | 'unknown' by inspecting the geometry.

    Centerline = line cells (n_faces == 0, n_lines > 0) and/or a per-point radius array.
    Surface    = polygonal faces.
    """
    import pyvista as pv

    try:
        m = pv.read(path)
    except Exception:
        return "unknown"
    has_radius = any(n in m.point_data for n in RADIUS_ARRAY_NAMES)
    n_lines = int(getattr(m, "n_lines", 0) or 0)
    n_faces = int(getattr(m, "n_faces", 0) or 0)
    if has_radius or (n_lines > 0 and n_faces == 0):
        return "centerline"
    if n_faces > 0:
        return "surface"
    return "unknown"


def discover_case_files(case_dir: str) -> dict:
    """Map a case folder to {'surface': path|None, 'centerline': path|None, 'all': [...]}"""
    surface = centerline = None
    all_files = find_meshes(case_dir)
    for f in all_files:
        kind = classify_mesh(f)
        if kind == "centerline" and centerline is None:
            centerline = f
        elif kind == "surface" and surface is None:
            surface = f
    return {"surface": surface, "centerline": centerline, "all": all_files}


def read_centerline(path: str):
    """Return (points Nx3 float, radius N float | None, polylines list[list[int]], pv_mesh).

    polylines is the VTK line connectivity parsed into index sequences (one per branch).
    """
    import numpy as np
    import pyvista as pv

    m = pv.read(path)
    pts = np.asarray(m.points, dtype=float)

    radius = None
    for n in RADIUS_ARRAY_NAMES:
        if n in m.point_data:
            radius = np.asarray(m.point_data[n], dtype=float)
            break

    # Parse VTK line connectivity: flat array [k, p0..p{k-1}, k2, ...].
    polylines: list[list[int]] = []
    lines = m.lines
    if lines is not None and len(lines):
        i = 0
        lines = list(map(int, lines))
        while i < len(lines):
            k = lines[i]
            polylines.append(lines[i + 1: i + 1 + k])
            i += 1 + k
    return pts, radius, polylines, m
