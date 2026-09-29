# Ceiling ventilation diffuser family — issue 227

Original, generic slotted HVAC diffuser modeled from the store's existing
five by two and a half foot ceiling module and two by one foot vestibule plane.
This is a scene-fit design, not an exact reproduction of a named product.
No third-party geometry, images, or branded references are used.

Source: `tools/models/hvac-diffuser.blend`. Reproducible Blender 5.2 script:
`tools/models/hvac-diffuser.py`. Runtime: `public/models/hvac-diffuser.glb`.
Metrics: `docs/hvac-diffuser-cost.json`. The Blender script recreates the
source and runtime artifacts; `node tools/models/measure-hvac-diffuser.mjs`
adds measured exported GLB geometry and bounds to the cost file.

Blender coordinates are `(store x, -store z, height)` and export Y-up to store
coordinates. Numerical units are store feet. The origin is the center of the
module at the nominal ceiling underside; +Y points into the ceiling, and the
frame, shadow pan, and directional louvers face down. Unscaled envelope is
4.97 by 2.47 feet, from Y -0.215 to +0.015 feet. The 0.03 foot clearance from
the five by two and a half foot grid module keeps it clear of the T-bars.
The installed ceiling origin stays at `ceilingY - 0.03`. The vestibule copies
use the same origin at `wallH - 0.01` and uniform scale `ventW / 5`, retaining
their prior two by one footprint and positions. These are visual fittings, so
there is no new collision or interaction shape.

Named closed parts and material roles are `DiffuserFrame` / `PaintedSteel`,
`RecessPan` / `RecessShadow`, and `DirectionalLouvers` / `LouverMetal`. The
frame has an open throat and folded return, backed by a dark inset pan. Ten
angled metal blades and a center stiffener create real depth without alpha
textures. All parts have manifold checks and planar UVs in feet; the runtime
asset uses no bitmap textures. Only the steel finish is lightly lifted by the
room bounce; the pan remains dark and the fixture emits no light.

The runtime loader shares one geometry and material for each part across all
instances within a scene group. The main room uses three instanced draws for
its entire vent family; the vestibule uses three draws for both copies. The
existing textured planes remain until shader preparation succeeds, then hide.
Failed or cancelled loads keep the planes. Late results, source GLB resources,
instancing buffers and installed geometry/materials are released on teardown.
The loading path uses the app's base-path resolver and scheduled detail
preparation. Existing ceiling and vestibule grid, lighting, and collision
anchors remain unchanged.

Verification photographs and run notes are kept privately in
`scratch/publicity-kits/cecil-vent-model` so public builds do not carry
synthetic-library imagery. 