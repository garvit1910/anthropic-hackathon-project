#!/usr/bin/env python3
"""
PHASE 1 — Geometry Foundation (Ronuk).

Goal: get the vessels and aneurysm as clean 3D meshes on screen — the "make the invisible
visible" moment.

Inputs:
    * Hero cases: Aneurisk/AneuX surface meshes (.vtp / .stl) — already 3D.
    * Showcase case (one): a TOF-MRA .nii volume — the only true 2D->3D reconstruction.
Outputs (per case, contract-compliant, same world frame):
    * vessel_tree.glb
    * aneurysm.glb

Handoff -> Garvit: these GLBs replace the placeholders in artifacts_mock/. Same filenames,
same frame -> the viewer loads them unchanged.

Runs in the `neurovas` conda env (pyvista, trimesh, nibabel, scikit-image). Not runnable in a
bare env — build the env first: `conda env create -f environment.yml`.
"""

from __future__ import annotations

import argparse
import os


# ── Pre-built path (hero cases) ─────────────────────────────────────────────────────────────
def load_and_clean_mesh(path: str):
    """Load a .vtp/.stl surface mesh, keep the largest connected component, fill small holes,
    lightly smooth. Returns a PyVista PolyData."""
    import pyvista as pv

    mesh = pv.read(path)
    mesh = mesh.connectivity(largest=True)          # drop disconnected fragments
    mesh = mesh.fill_holes(hole_size=1.0)           # close small gaps
    mesh = mesh.smooth_taubin(n_iter=20, pass_band=0.1)  # denoise without shrinking
    return mesh


# ── Reconstruction path (one TOF-MRA showcase case) ─────────────────────────────────────────
def reconstruct_from_tof_mra(nii_path: str):
    """.nii volume -> vessel surface mesh via Frangi vesselness + marching cubes.

    TOF-MRA makes flowing blood bright by design, so vessels are segmentable without contrast.
    Fallback for noisy volumes: a pretrained nnU-Net (download weights; no training).
    """
    import nibabel as nib
    import numpy as np
    from skimage.filters import frangi
    from skimage.measure import marching_cubes

    volume = nib.load(nii_path).get_fdata()
    vesselness = frangi(volume)                     # enhance tubular structures
    mask = vesselness > np.percentile(vesselness, 99.0)  # TODO: tune threshold per scan
    verts, faces, _normals, _values = marching_cubes(mask.astype(float), level=0.5)
    # TODO: apply the .nii affine so verts land in mm world coordinates.
    return verts, faces


def isolate_aneurysm(mesh, voxel_label=None):
    """Split the aneurysm sub-mesh from the parent vessel so it can be styled/animated on its
    own. Hero cases: use the dataset's provided aneurysm label/region. Reconstructed case: use
    the voxel label from the segmentation."""
    raise NotImplementedError("TODO: split aneurysm region using the dataset's label")


# ── GLB export ──────────────────────────────────────────────────────────────────────────────
def export_glb(vertices, faces, out_path: str) -> None:
    """Write a mesh to GLB (the format the web viewer loads natively)."""
    import trimesh

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
    mesh.export(out_path)
    print(f"wrote {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 1: meshes -> vessel_tree.glb + aneurysm.glb")
    ap.add_argument("--case", required=True, help="case id, e.g. C0035")
    ap.add_argument("--vessel-mesh", help=".vtp/.stl vessel surface (hero path)")
    ap.add_argument("--nii", help="TOF-MRA .nii volume (reconstruction path)")
    ap.add_argument("--out", default="artifacts", help="output artifacts root")
    args = ap.parse_args()

    out_dir = os.path.join(args.out, f"case_{args.case}")
    os.makedirs(out_dir, exist_ok=True)

    # TODO: wire the two paths through clean -> isolate -> export, writing:
    #   {out_dir}/vessel_tree.glb  and  {out_dir}/aneurysm.glb
    raise SystemExit("Phase 1 skeleton — implement mesh clean/reconstruct/export, then export GLBs.")


if __name__ == "__main__":
    main()
