# Recessed fluorescent troffer — issue #226

Original generic folded-sheet construction, fitted to the existing store module.
This is a housing upgrade, separate from the exposed pendant luminaires in #285.
The prismatic lens, its hot-band texture, emissive/bake settings and the room's
actual light placement remain owned by the existing application.

## Contract and provenance

The established ceiling grid deliberately uses an oversized **5 × 2.5 ft**
module. Long axis is X, short axis Z, Y points upward, and the origin is the
ceiling plane. Blender authors `(storeX, -storeZ, storeY)` and exports Y-up;
its imperial scale is 0.3048 metres per unit while runtime coordinates remain feet.

The lens remains a **4.88 × 2.38 × 0.04 ft** box centered at **Y = −0.06 ft**,
with the original BoxGeometry UVs. The door's clear opening is exactly 4.88 ×
2.38 ft, so it does not reduce the lens's emitting aperture. The door rim hangs
to −0.14 ft, exposing a 0.06 ft reveal below the original lens underside.
The pan rises to +0.285 ft, its service cover/fasteners to +0.311 ft, clear of
the main roof slab's +0.35 ft underside. The maximum housing footprint fits
inside the 5 × 2.5 ft cell, including latches and hinge barrels.

The source contains a welded tapered reflector pan, mitred folded door rim
with a lens seat, two retaining spring latches, rear hinge leaves/barrels,
ballast service cover, two fluorescent tubes with end caps, and lampholders.
The tube axes follow the two existing procedural lens hot bands. The closed
lens is retained in runtime geometry, not replaced by a densely modelled prism
surface. The housing GLB intentionally omits the lens so the live application
continues to supply that established surface.

Period interior reference crops were inspected to confirm narrow pale rims and
recessed rectangular lenses. They do not show the plenum-side construction or
establish a manufacturer's exact dimensions. Pan depth, sheet thickness, folds,
clips and service hardware are original generic construction estimates. No
photograph pixels, branded artwork, third-party geometry or reference-derived
texture is included in the exported asset.

## Assets and cost

- `tools/models/fluorescent-troffer.py`: reproducible scripted Blender authoring.
- `tools/models/fluorescent-troffer.blend`: editable named physical parts with UVs.
- `public/models/fluorescent-troffer.glb`: three geometry batches by material role.
- `docs/fluorescent-troffer-cost.json`: measured export cost.

Run `blender -b -t 2 -P "$PWD/tools/models/fluorescent-troffer.py"`.
The source checks every closed part for manifold edges before export.
`TrofferHousing` uses `TrofferPaint`, cloned from the application's existing
frame finish at installation. `TrofferHardware` supplies small satin steel
fittings and `TrofferTubes` supplies nonemissive tube glass. No new textures,
lights, shadow-casting light passes or emissive materials are introduced.
The export has 1,352 triangles, three material/geometry batches, 23 source parts,
no images and 94,236 bytes. Each deck costs three instanced housing draws and
one instanced lens draw regardless of its troffer count. The hidden fallback
frame remains owned for the existing teardown path.

## Integration and lifecycle

`troffer-model.ts` batches both the original fallback frame and the unchanged
lens. The main deck and the lowered checkout deck retain their own accepted
module centers and heights; the main deck's 4-cell light phases, cornice and
vestibule exclusions, and soffit occlusion rules are unchanged. The grid kit
no longer owns or prematurely hides the troffer fallback. Real holes in the
ceiling/lid expose the pan instead of leaving a tile plane through its cavity;
main-ceiling UVs retain their original full-room phase. Circular downlight
soffits and exposed pendant ceilings keep their separate implementations.

The installer uses `assetUrl`, the existing detail-load queue and GPU preparation
hooks. It validates the named parts/envelope, prepares all three batches while
the fallback stays visible, and adopts them together. Missing, malformed or
failed preparation leaves the original illuminated fallback. Removal cancels
queued work; late loads are disposed; instance buffers, owned geometry and
cloned finishes are released on removal or scene geometry teardown. Borrowed
lens/frame materials and the shared prismatic map stay with their caller.
Successful adoption refreshes structural shadows and requests a render.

## Verification

`tests/troffer-model.test.ts` validates the exported envelope, real cavity and
recess depth, two tube channels, UVs, normals, source cost, ceiling apertures and
UV phase. Installer checks cover exact lens dimensions/height/emission,
instancing, atomic preparation, offline/malformed fallback, queued cancellation,
late loads and preservation of borrowed material/texture ownership.
The ceiling-grid, soffit-anchor and exposed-luminaire tests cover neighboring
contracts. Before/after photographs use the existing StoreScene screenshot
harness; underside, side and rear detail photographs use the existing asset
viewer. Public evidence contains only the project's fictional brand.
