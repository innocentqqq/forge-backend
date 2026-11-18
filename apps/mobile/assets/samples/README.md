# Sample models

STL and OBJ fixtures used by the `app/dev/viewer.tsx` playground. All coordinates are
in millimetres. Regenerate them (and the base64 module the dev screen imports, since
Metro does not treat `.stl`/`.obj` as asset extensions) with
`python3 apps/mobile/assets/samples/generate_samples.py`.

| File | Dimensions (mm) | Purpose |
|---|---|---|
| `small-cube.stl` | 10 × 10 × 10 | Ordinary small part that fits any printer bed. |
| `small-cube.obj` | 10 × 10 × 10 | Same part as quads, exercising the OBJ triangulation path. |
| `large-box.stl` | 320 × 220 × 300 | Exceeds a typical 220 × 220 × 250 mm bed; exercises the build-volume warning. |
| `frame-with-hole.stl` | 40 × 40 × 10, 20 × 20 mm through-hole | Shows concave geometry and the progress clipping plane cutting across a hole. |
