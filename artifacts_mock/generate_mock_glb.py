#!/usr/bin/env python3
"""
generate_mock_glb.py — build placeholder vessel_tree.glb + aneurysm.glb for the mock case.

These are NOT real anatomy. They exist so Garvit's viewer has valid, correctly-framed GLBs to
load and overlay while the real pipeline is still producing artifacts. Geometry is built as
small boxes ("beads") traced along the mock graph.json, so the placeholder vessels and the
mock graph occupy the same world frame (mm, Y-up) — exactly the overlay the real files must
also satisfy.

Stdlib only (struct + json). Run from the repo root:
    python artifacts_mock/generate_mock_glb.py
"""

from __future__ import annotations

import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
CASE = os.path.join(HERE, "case_C0035")

# 6 box faces, each with an outward normal and 4 corner offsets (in units of half-size).
_FACES = [
    ((1, 0, 0), [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)]),
    ((-1, 0, 0), [(-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1)]),
    ((0, 1, 0), [(-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)]),
    ((0, -1, 0), [(-1, -1, 1), (-1, -1, -1), (1, -1, -1), (1, -1, 1)]),
    ((0, 0, 1), [(1, -1, 1), (1, 1, 1), (-1, 1, 1), (-1, -1, 1)]),
    ((0, 0, -1), [(-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1)]),
]


def _box(center, size, positions, normals, indices):
    """Append one axis-aligned box (24 verts, flat normals, 36 indices) to the buffers."""
    cx, cy, cz = center
    h = size / 2.0
    for normal, corners in _FACES:
        base = len(positions) // 3
        for ox, oy, oz in corners:
            positions.extend((cx + ox * h, cy + oy * h, cz + oz * h))
            normals.extend(normal)
        indices.extend((base, base + 1, base + 2, base, base + 2, base + 3))


def _write_glb(path, positions, normals, indices, color):
    nverts = len(positions) // 3
    xs, ys, zs = positions[0::3], positions[1::3], positions[2::3]
    pos_min = [min(xs), min(ys), min(zs)]
    pos_max = [max(xs), max(ys), max(zs)]

    pos_bytes = struct.pack(f"<{len(positions)}f", *positions)
    nrm_bytes = struct.pack(f"<{len(normals)}f", *normals)
    idx_bytes = struct.pack(f"<{len(indices)}H", *indices)
    bin_blob = pos_bytes + nrm_bytes + idx_bytes
    bin_blob += b"\x00" * ((4 - len(bin_blob) % 4) % 4)  # pad to 4 bytes

    gltf = {
        "asset": {"version": "2.0", "generator": "neurovas mock generator"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1},
                                    "indices": 2, "material": 0, "mode": 4}]}],
        "materials": [{
            "pbrMetallicRoughness": {"baseColorFactor": color, "metallicFactor": 0.1,
                                     "roughnessFactor": 0.6},
            "doubleSided": True,
        }],
        "buffers": [{"byteLength": len(bin_blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bytes), "byteLength": len(nrm_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bytes) + len(nrm_bytes),
             "byteLength": len(idx_bytes), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": nverts, "type": "VEC3",
             "min": pos_min, "max": pos_max},
            {"bufferView": 1, "componentType": 5126, "count": nverts, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5123, "count": len(indices), "type": "SCALAR"},
        ],
    }

    json_blob = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_blob += b" " * ((4 - len(json_blob) % 4) % 4)  # pad to 4 bytes with spaces

    total = 12 + 8 + len(json_blob) + 8 + len(bin_blob)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(json_blob), b"JSON"))
        f.write(json_blob)
        f.write(struct.pack("<I4s", len(bin_blob), b"BIN\x00"))
        f.write(bin_blob)
    print(f"wrote {os.path.relpath(path)}  ({nverts} verts, {total} bytes)")


def main():
    with open(os.path.join(CASE, "graph.json")) as f:
        graph = json.load(f)

    # vessel_tree: beads along every edge polyline + at every node.
    vp, vn, vi = [], [], []
    for n in graph["nodes"]:
        _box(n["pos"], 1.8, vp, vn, vi)
    for e in graph["edges"]:
        for p in e["polyline"]:
            _box(p, 1.2, vp, vn, vi)
    _write_glb(os.path.join(CASE, "vessel_tree.glb"), vp, vn, vi, [0.75, 0.18, 0.18, 1.0])

    # aneurysm: one larger box at the aneurysm node.
    ap, an, ai = [], [], []
    aneurysm_pos = next(n["pos"] for n in graph["nodes"] if n["id"] == graph["aneurysm_node"])
    _box(aneurysm_pos, 4.2, ap, an, ai)
    _write_glb(os.path.join(CASE, "aneurysm.glb"), ap, an, ai, [0.95, 0.55, 0.15, 1.0])


if __name__ == "__main__":
    main()
