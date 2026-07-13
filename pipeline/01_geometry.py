#!/usr/bin/env python3
"""
PHASE 1 — Geometry Foundation (Ronuk).

Get the vessels and aneurysm as clean 3D meshes on screen — the "make the invisible visible"
moment. Output two GLBs per case, in ONE shared world frame (mm, Y-up):
    vessel_tree.glb   — the cleaned vessel surface
    aneurysm.glb      — the isolated aneurysm sac (styled/animated independently by the viewer)

Two input paths:
    Hero path (Aneurisk/AneuX):  a .vtp/.stl surface, already 3D → clean → export.
    Reconstruction path (one showcase): a TOF-MRA .nii volume → Frangi vesselness → marching
                                        cubes → surface. The only true 2D→3D reconstruction.

Mesh cleaning uses pyvista (conda env); GLB export uses trimesh. Heavy imports are lazy so the
export helper is testable without a mesh library.

Usage:
    python pipeline/01_geometry.py --case C0035 --vessel-mesh model.vtp --aneurysm-center 20 9 61
    python pipeline/01_geometry.py --case C0035 --nii tof_mra.nii.gz
"""

from __future__ import annotations

import argparse
import os

import numpy as np


# ── hero path: clean an existing surface mesh ───────────────────────────────────────────────
def load_and_clean_mesh(path: str):
    """Load a .vtp/.stl surface; keep the largest connected component, fill small holes, lightly
    smooth. Returns a pyvista PolyData."""
    import pyvista as pv

    mesh = pv.read(path)
    mesh = mesh.extract_largest().extract_surface()   # drop disconnected fragments
    mesh = mesh.fill_holes(1.0)                        # close small gaps
    mesh = mesh.smooth_taubin(n_iter=20, pass_band=0.1)  # denoise without shrinking
    return mesh.triangulate()


# ── reconstruction path: TOF-MRA .nii → surface ─────────────────────────────────────────────
def reconstruct_from_tof_mra(nii_path: str, brain_mask_path: str | None = None,
                             method: str = "intensity", percentile: float = 96.0,
                             min_component_voxels: int = 30, sigmas=(1, 2, 3, 4)):
    """.nii TOF-MRA volume → vessel surface (vertices, faces) in mm world coords.

    TOF-MRA makes flowing blood BRIGHT by design, so vessels are the brightest voxels.

    method='intensity' (default, needs brain_mask_path): threshold the brightest voxels inside
      the brain and keep EVERY vessel component ≥ min_component_voxels — this renders the whole
      cerebral tree (both hemispheres, distal branches), not just the largest branch. `brain_mask`
      may be a binary mask OR a brain-extracted angio image (used directly as intensity).
    method='frangi' (no mask): multiscale vesselness (black_ridges=False) then the same
      keep-all-sizable-components step.
    A pretrained nnU-Net (download weights; no training) is the fallback for noisy volumes."""
    import nibabel as nib
    from scipy import ndimage
    from skimage.measure import marching_cubes

    img = nib.load(nii_path)
    volume = img.get_fdata().astype(np.float32)

    if method == "intensity" and brain_mask_path:
        bm = nib.load(brain_mask_path).get_fdata().astype(np.float32)
        if np.unique(bm[::5, ::5, ::5]).size > 10:        # brain-extracted angio → use as intensity
            intensity, brain = bm, bm > 0
        else:                                              # binary mask → apply to the raw volume
            intensity, brain = volume, bm > 0
        mask = (intensity > np.percentile(intensity[brain], percentile)) & brain
    else:
        from skimage.filters import frangi
        v = (volume - volume.min()) / (np.ptp(volume) + 1e-9)
        ves = frangi(v, sigmas=sigmas, black_ridges=False)
        mask = ves > np.percentile(ves, percentile)

    labels, n = ndimage.label(mask)                        # keep every sizable vessel (whole tree)
    if n > 1:
        sizes = ndimage.sum(mask, labels, range(1, n + 1))
        keep = np.where(sizes >= min_component_voxels)[0] + 1
        mask = np.isin(labels, keep)
    mask = ndimage.binary_closing(mask, iterations=1)      # bridge 1-voxel gaps for continuity

    verts, faces, _n, _v = marching_cubes(mask.astype(np.float32), level=0.5)
    verts = nib.affines.apply_affine(img.affine, verts)    # voxel → mm world coordinates
    return verts, faces


# ── aneurysm isolation ──────────────────────────────────────────────────────────────────────
def isolate_aneurysm(vessel_mesh, center, radius_mm: float):
    """Clip the sac out of the vessel surface with a sphere around the aneurysm centroid.

    Aneurisk hero cases don't always ship a sac label, so this geometric clip is the general
    fallback; if the dataset provides an aneurysm label/region, prefer that. `center` comes from
    Phase 2 (the aneurysm node position) or the dataset."""
    import pyvista as pv

    sphere = pv.Sphere(radius=radius_mm, center=center)
    clipped = vessel_mesh.clip_surface(sphere, invert=True)
    return clipped.extract_largest().extract_surface().triangulate()


# ── GLB export (trimesh) ────────────────────────────────────────────────────────────────────
def _pv_to_arrays(mesh):
    """pyvista PolyData → (vertices Nx3, faces Mx3). Assumes a triangulated surface."""
    faces = mesh.faces.reshape(-1, 4)[:, 1:]   # [3, i, j, k] per triangle
    return np.asarray(mesh.points, dtype=float), np.asarray(faces, dtype=np.int64)


def export_glb(vertices, faces, out_path: str, color=None) -> None:
    """Write a mesh to GLB (the format the web viewer loads natively)."""
    import trimesh

    mesh = trimesh.Trimesh(vertices=np.asarray(vertices, dtype=float),
                           faces=np.asarray(faces), process=False)
    if color is not None:
        mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, face_colors=color)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    mesh.export(out_path)
    print(f"wrote {out_path}: {len(mesh.vertices)} verts, {len(mesh.faces)} faces")


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 1: meshes/scan → vessel_tree.glb + aneurysm.glb")
    ap.add_argument("--case", required=True)
    ap.add_argument("--vessel-mesh", help=".vtp/.stl vessel surface (hero path)")
    ap.add_argument("--nii", help="TOF-MRA .nii volume (reconstruction path)")
    ap.add_argument("--brain-mask", help="brain mask / brain-extracted angio (full-vasculature recon)")
    ap.add_argument("--recon-method", choices=["intensity", "frangi"], default="intensity")
    ap.add_argument("--recon-percentile", type=float, default=96.0)
    ap.add_argument("--min-component-voxels", type=int, default=30)
    ap.add_argument("--aneurysm-center", type=float, nargs=3, help="x y z of the sac (mm)")
    ap.add_argument("--aneurysm-radius", type=float, default=6.0, help="clip radius (mm)")
    ap.add_argument("--out", default="artifacts")
    args = ap.parse_args()

    out_dir = os.path.join(args.out, f"case_{args.case}")
    os.makedirs(out_dir, exist_ok=True)

    if args.vessel_mesh:
        vessel = load_and_clean_mesh(args.vessel_mesh)
        v, f = _pv_to_arrays(vessel)
    elif args.nii:
        v, f = reconstruct_from_tof_mra(args.nii, brain_mask_path=args.brain_mask,
                                        method=args.recon_method, percentile=args.recon_percentile,
                                        min_component_voxels=args.min_component_voxels)
        import pyvista as pv
        vessel = pv.PolyData(v, np.hstack([np.full((len(f), 1), 3), f]).astype(np.int64))
    else:
        raise SystemExit("provide --vessel-mesh (hero) or --nii (reconstruction)")

    export_glb(v, f, os.path.join(out_dir, "vessel_tree.glb"), color=[190, 46, 46, 255])

    if args.aneurysm_center:
        sac = isolate_aneurysm(vessel, args.aneurysm_center, args.aneurysm_radius)
        sv, sf = _pv_to_arrays(sac)
        export_glb(sv, sf, os.path.join(out_dir, "aneurysm.glb"), color=[242, 140, 38, 255])
    else:
        print("  ⚠ no --aneurysm-center given; skipped aneurysm.glb "
              "(run Phase 2 first to get the aneurysm node position)")


if __name__ == "__main__":
    main()
