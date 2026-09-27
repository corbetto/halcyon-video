# New Release wall shelving — issue #311

Original Blender mesh construction for Halcyon's existing shelf layout. No downloaded meshes, textures, private reference files, or branded artwork are included.

The construction contract uses particleboard with beige vinyl laminate, eight tiers in eight-foot sections, high-backed angled shelves, and space for three rental cases behind a cover comfortably (four tightly). A separate capacity study demonstrates five shelves of eight facings; it is not a historical store recreation.

The reconstruction uses an **8 ft wide × 8 ft high, 1.32 ft deep at the floor and 0.55 ft at the top, with a steeper lower two-tier flare** carcass, 3/4-inch tray boards, a 5° tray slope rising toward the customer, 0.65 ft high individual backs, continuous full-height tapered end uprights enclosing the sloped shelves and front price rails, a grounded recessed toe kick plinth, and recessed price-card channels. Height, depth, angle, sheet thickness, edge profiles and hardware details are modeling assumptions, not measured historical specifications. Tier elevations match the existing scene: 0.42 through 6.545 ft at 0.875 ft intervals. This preserves clearance for the existing VHS cases and sign anchors.

- Editable source: `tools/models/new-release-wall.blend`.
- Deterministic authoring: `tools/models/new-release-wall.py`.
- Runtime: `public/models/new-release-wall.glb` (61,980 bytes, 752 triangles, 28 separate mesh parts).
- Metrics: `tools/models/new-release-wall-metrics.json`.
- Material roles: `BeigeVinylLaminate`, `BeigeVinylEdgeBand`, `SatinPriceChannel`; opaque PBR, zero metalness, no texture downloads.

Each swept part is a closed manifold solid with outward normals and UV islands. The channel recess is modeled geometry. Blender uses imperial display with scale length 0.3048; numeric coordinates remain feet, as the Three.js store expects. Authoring maps store `(x,y,z)` to Blender `(x,-z,y)`; glTF exports Y-up without a runtime unit conversion.

The hidden **Capacity study — NOT exported** collection contains eight facings per tier. The bottom five tiers share one neutral cover design; the upper three use other colors. Each facing has a cover plus three nominal 1.25-inch Amray cases; the rightmost column demonstrates four. This is an editable dimensional study, not a replacement for catalog artwork. The yellow wall and blue labels are also study-only; the live store owns its existing wall and brand signage.

`NrWallModelBatch` installs geometry at the existing local +Z wall-run anchors, repeats eight-foot board/back sections, trims a final partial section, and merges the result to three material draw calls per run. Catalog dividers retain their current positions and double-feature suppression. Full merchandising bays contain eight display boxes, independent of eight-foot construction joints. Final partial bays use the remaining wall width. Divider nudges, title allocation, and topper spacing share NR_SECTION_COLS. The runtime retains the existing display/rental count rather than creating invented rental inventory. Timber formats keep their existing material path.

The tapered depth feeds the row-specific cover hinge and fallback geometry. The retired rear-right notch cannot be enabled by old saved settings. Stock height follows the new sloped support plane. Fallback boards have matching depth and slope; original meshes remain hidden collision proxies after successful loading. Missing/malformed exports leave fallback visible, disposed scene geometry cancels pending adoption, and imported templates are released after merging. Adopted meshes/materials use normal scene teardown.

Regenerate from the repository root (absolute script path is needed by the ThinkPad Flatpak CLI):

```sh
blender -b -t 2 -P "$(pwd)/tools/models/new-release-wall.py"
# Also render the capacity study:
blender -b -t 2 -P "$(pwd)/tools/models/new-release-wall.py" -- --render /tmp/new-release-wall.png
node tools/verify-nr-wall.mjs /tmp/nr-wall-verification
npm test && npm run build
```

The browser verification renders the real installer in an isolated yellow-wall scene, including two full sections and a one-foot trimmed section. It is not a screenshot of a populated production catalog. Asset tests check tier/section dimensions, slope, usable capacity, finite UVs/normals, materials, draw-call merging, fallback behavior and disposal during loading.

## Complete bay layout

The perimeter planner fits only complete 4.8-foot bays with eight centered stock
columns. The same runs drive geometry, dividers, stock, wall-mounted signs and
clerk collision boundaries. Both side walls are stocked behind their windows;
the right-side service door retains its clearance. The 1990 cornice contains a
recessed fitting at each bay and real circular apertures through its underside.
The repeated fittings share instanced geometry and materials. Six nearby shelf
beams are reused as the visitor moves, bounding rendering cost.

## Lower browsing tiers

The bottom two rows use a reconstruction estimate from period store footage:
25 degrees from vertical on the bottom row, 18 degrees on the next, and the
existing 10 degrees above. The footage is oblique and uncalibrated: these are
working reconstruction angles, not recovered manufacturer specifications.

Relative to the original upper taper, the lowest shelf projects an additional
0.22 ft (2.64 inches), the second 0.11 ft (1.32 inches), and the third zero.
The side profile interpolates through those stations. New Release runs,
standard gondolas and game-department shelves share this lower-tier treatment;
the independent shop's untapered timber library case retains its own format.
Series box sets remain upright for their existing support/packaging contract.
Decks retain their existing support slope; cover inclination is independent.

Shelf fronts, dividers, end panels, collision footprints, stock hinges and
rental packing all follow the new profile. The gondola Blender kit includes
additional profile vertices; scaling only a four-corner trapezoid cannot bend
at the lower rows. `tests/shelf-profile.test.ts` checks the flare, upper-tier
depth, upward-facing cover normals, exported bend stations and wall enclosure.
