# Dependencies — running the NeuroVas 3D model

Two separate things you might run. **Viewing** the 3D model is light; **regenerating** the
artifacts (the pipeline) needs the Python scientific stack.

---

## A) Just VIEW the 3D model — `viewer.html`

The viewer is a **single self-contained HTML file**. No build step, no `npm`, no bundler.

**You need:**
1. **A modern browser with WebGL2** — Chrome, Safari, Firefox, or Edge.
2. **three.js r160**, loaded at runtime from the **unpkg CDN** (so the first load needs internet):
   - `three@0.160.0` (`three.module.js`) + addons `OrbitControls`, `GLTFLoader`, wired via an
     `<script type="importmap">` inside `viewer.html`.
3. **A static HTTP server.** The viewer `fetch()`es the `.glb`/`.json` files, so opening it via
   `file://` fails (browser CORS). Any static server works — the simplest uses only the Python
   **standard library** (nothing to `pip install`):
   ```bash
   cd <repo>
   python3 -m http.server 8137
   # then open  http://localhost:8137/viewer.html
   ```
   (`npx http-server`, `nginx`, VS Code Live Server, etc. all work too.)
4. **The artifact files** it renders — already git-tracked in the repo:
   `artifacts/case_*/` → `vessel_tree.glb`, `aneurysm.glb`, `graph.json`, `streamlines.json`,
   `catheter_paths.json`, `morphology.json`, `wss.json`.

> **Fully offline?** three.js is CDN-loaded. To run with no internet, vendor `three.module.js`
> and the two addons locally and repoint the importmap in `viewer.html`.

**No GPU required** — WebGL runs on any integrated graphics.

---

## B) REGENERATE the artifacts — the Python pipeline

Only needed if you want to rebuild the `.glb`/`.json` from raw data (not needed just to view).

**Python 3.9–3.14** (tested on 3.14). Install with pip:
```bash
pip install numpy scipy networkx pandas trimesh pyvista nibabel scikit-image
```
`pyvista` automatically pulls in **vtk** and **matplotlib**. `contracts.py` and
`validate_artifacts.py` use the **standard library only**.

| Package | Used for |
|---|---|
| **numpy / scipy** | arrays; `ndimage` (resample, distance transform, morphology); `spatial` (KDTree, ConvexHull) |
| **networkx** | vessel graph + shortest-path catheter routing |
| **pandas** | dataset CSVs (clinical / morphometrics) |
| **trimesh** | GLB read/write, mesh voxelization, geometry |
| **pyvista** (→ **vtk**) | read `.vtp`/`.stl` surfaces + centerlines; Taubin surface smoothing |
| **nibabel** | read TOF-MRA `.nii.gz` volumes + aneurysm masks |
| **scikit-image** | Frangi vesselness, marching cubes, 3D skeletonization |

**Tested versions:** numpy 2.5.1 · scipy 1.18.0 · networkx 3.6.1 · pandas 3.0.3 · trimesh 4.12.2
· pyvista 0.48.4 · vtk 9.6.2 · nibabel 5.4.2 · scikit-image 0.26.0.

**Hardware:** CPU-only is fine — no GPU/CUDA needed (a GPU foundation-model path, VesselFM, was
explored and dropped).

**Datasets** (git-ignored — download separately, only to rebuild cases):
- **Aneurisk** (case C0001): `github.com/hkjeldsberg/AneuriskDatabase`
- **CMHA** (real-CFD case): figshare `10.6084/m9.figshare.26965450` (Song et al., Sci Data 2024)
- **Lausanne** (hero + reconstruction showcase): OpenNeuro **ds003949**

Quick check the whole pipeline works after install:
```bash
python pipeline_selftest.py            # exercises Phases 1-4 on synthetic geometry -> ALL PHASES PASS
python validate_artifacts.py artifacts/case_HERO_sub013
```
