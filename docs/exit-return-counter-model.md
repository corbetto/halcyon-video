# Enclosed exit returns counter

An original enclosed returns station shares the main checkout's blue/theme-colored rim, routed millwork profile, contrasting inlay and white lower worktops. The window-side run is a lower white worktop that meets the front glass, with no raised blue shelf behind it. Two angled customer-facing runs form a projecting point and leave an entrance beside the vestibule; the open vestibule-side end admits staff, with a continuous closed wall at the far end. A compact low white return receiver, with a gently sloped lid and rear throat, sits against the window on that worktop. The shallow window flap sits above the outward vinyl; the clear glass between flap and receiver remains visible. Its dimensions are design proportions, not measurements of a photographed store.

- Authoring: `tools/models/exit-return-counter.py`, using the existing checkout authoring functions before their variant-export entry point.
- Editable source: `tools/models/exit-return-counter.blend`.
- Runtime: `public/models/exit-return-counter.glb`.
- Coordinates: feet, local glass plane z=0.18, interior extends toward negative z. Runtime origin is 0.18 feet inside the front-glass datum. X scales for room width; Y remains constant; Z follows the front vestibule panel.
- Envelope: 15.5 by 11.68 feet; customer rim height 3.54 feet, white worktop height 2.82 feet, receiver roof height 3.55 feet. The white window run spans the entire rear and reaches the glass. The approximately 6.05-foot staff opening lies beside the vestibule between the white worktop and angled run end. Six material batches, see the generated metrics for triangle count, closed manifold construction parts, UVs and outward normals.
- Theme roles are shared with checkout: CounterBody, CounterTop, CounterInlay, CounterWorktop, CounterPlinth. The dark receiver interior retains CounterReveal.
- Placement and physical navigation segments: `src/exit-return-layout.ts`. The full envelope reserves floor space for fixtures; only the actual millwork obstructs staff navigation.
- Display loader: brand-pack override, then local override, then public model. Hosted builds skip private probes. Missing meshes retain an enclosed procedural fallback. Return-case stacks rest on the lower window-side worktop.

Validation: production build and complete test suite, plus staff-entry path coverage. In-app context, overhead and interior evidence lives in `scratch/publicity-kits/front-layout/` for direct dev landing. Private historical reference imagery is not included.

The staff opening faces the vestibule. The white window worktop stops before the staff approach; the angled sorting worktop and customer rim remain clear of the approach. Exit sensors stand on the sales-floor side of the tapered doorway, outside its leaf sweep, using `vestibuleExitGates`.

## Front merchandising arrangement

The concessions form one joined run, ordered snacks, popcorn, beverage cooler along its local positive X axis. All fronts face the checkout approach. Bargain bins sit across a rear aisle on the far side of that run; the additional freezer is admitted to a separate clear pocket. Room bounds and obstacle checks admit complete concessions runs rather than scattering their members. Small rooms decline a run they cannot accommodate; the existing bargain-bin placement remains the fallback.

The corporate left shelf field starts nine world feet farther into the store. Its capacity solver extends the field toward the back as required, preserving catalog capacity and the open front merchandising floor. Independent-store geometry is unaffected. The plan follows the owner's approximate September 20 sketch; no drawing or private reference image is included in the repository.

The shared receiver and glazing dimensions live in src/exit-return-spec.json and are consumed by Blender authoring, the window hardware, shell aperture and footprint adapter. The body is 0.73 feet above the worktop; its shallow lid feeds an under-counter collection well. These are fitted design estimates from the reference arrangement, not surveyed dimensions.
