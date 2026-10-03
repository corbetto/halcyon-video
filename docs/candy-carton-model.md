# Folded theater-candy cartons

This is an original generic paperboard construction for the existing queue-rack
stock and count-based bag drops. It is not a measured commercial package or a
claim that every catalog choice is sold in a carton. The catalog's existing
names, sizes, row IDs and delivery choices remain unchanged, including bagged
products. Existing gondola pouches and dispenser packs are separate models.

## Source and attachment contract

The envelope is taken from the prior `CandyDisplay` and `dropCandyIntoBag`
implementations, not a photograph. The adjacent authored cleaner carton provided
the established Blender/GLB construction and loading pattern. The rack's authored
hardware, trays, placements, optional private counterpart and interaction
anchors remain in place.

| Consumer | Width × height × depth, feet | Placement |
| --- | --- | --- |
| Queue rack | .32 × .42 × .18 | Existing `candyStockMatrix`: Y scale .65, -12° tray tilt |
| Bag drop | .24 × .32 × .12 | Existing centered oriented-box collider and drop solver |

Blender uses `(x, -store_z, height)` and a .3048 metre display scale; glTF is Y-up,
centered at zero with +Z front. The rack's displayed height before tray rotation
is .273 feet. Bag dimensions are baked into geometry, so its cloth collider,
center, volume-derived weight, drop/lift motion and scale animation remain exact.
The two envelopes predate this family; they are not asserted to be the same SKU.

Estimated hidden construction: .0012-foot paperboard, .002-foot scored corner
radius, .035-foot tuck depth, .018-foot glue lap. These values are original
modeling decisions, not observed period measurements. Eight named manifold solid
parts form one scored sleeve, two folded tuck closures, four dust flaps and an
internal rear glue lap. There is no new sign, commercial mark, photographic
texture or brand-derived geometry.

## Assets and print

- Editable source: `tools/models/candy-carton.blend`.
- Reproducible script: `tools/models/candy-carton.py` (Blender, absolute script path).
- Runtime: `public/models/candy-carton.glb`.
- Measurements: `tools/models/candy-carton-metrics.json`.
- Shared integration: `src/fixtures/candy-carton.ts`.

The named `CandyCartonPaper` role is replaced by the existing runtime product
wraps from `src/fixtures/retail-packaging.ts`. Geometry has no embedded textures.
Front and rear UVs read upright from their respective viewing sides; narrow
folds and cut edges use the existing print's plain margin. Print remains a
separate, replaceable material. Generic labels are decorative and do not assert
an exact purchasable SKU or package-weight match. Custom rack labels or palette
options retain their existing canvas-card artwork.

## Runtime and ownership

One merged geometry is shared by all five instanced rack rows. The existing
175 placements remain five stock draws. Bag items share one geometry and five
materials. The loader replaces the caller's geometry contents in place, retaining
mesh/instance identities and the same bounds even for candy already falling
inside the bag. It releases the replaced GPU buffers before changing attributes.

A missing GLB retains the original box fallback. Disposal during loading cancels
installation and releases the late source geometry/materials. Imported source
parts are released after merging. The fixture and StoreScene retain their usual
geometry/material ownership; each generated print material releases its map on
disposal. Successful upgrades request a render and shadow refresh. No per-frame
loader work, new collision proxy, navigation change or physics change is added.

The bag API is still count-based, capped at five drops (three visible items), with its existing random
assortment behavior; this change does not claim to connect a rendered bag box to
a specific selected candy row. Movie title cases and bag solver code are untouched.

## Validation

Asset tests check actual exported bounds, centered origin, normals, front/back
UV direction, named parts, and triangle/byte limits. Focused browser evidence
checks installed rack instancing/identities, bag collision extents and weight
before/after asynchronous replacement, dropped-mesh identity, settling, lifting,
hiding, failed load, late-load cancellation and resource disposal. The existing
rack support checks cover its retained anchors. Public-safe before/after images,
side/rear details and a 390 × 844 emulated phone viewport are retained in
`scratch/publicity-kits/candy-194`. These are geometry and browser checks, not
physical-phone frame-rate measurements.


## Measured cost

The exported template has 180 triangles across eight named source parts, one
material role, zero embedded textures, and a 19,128-byte GLB. Runtime merges it to
one geometry: 31,500 stock triangles for 175 cartons in five draws (previously
2,100 triangles), plus at most 540 visible candy triangles in the bag. The five
existing 256-square wraps consume 1,310,720 RGBA bytes before mipmaps per owning
rack or bag material set (about 1.67 MiB including mipmaps). Rack print previously
used five 128-square cards. No texture network downloads are added.
