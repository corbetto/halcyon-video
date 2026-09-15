# Parking layout

The exterior uses one world-space plan for its parking spaces, cars, walkway,
ramps, grass verge and street position. It approximates a freestanding store
with parking on both sides and two facing front rows. Dimensions are design
choices, not a surveyed property or a claim of accessibility compliance.

- Stalls are 9 by 18 feet; the front and side driving aisles are 24 feet wide.
- The near row leaves its middle bay clear for the six-foot entrance ramp and
  hatched pedestrian approach. Sidewalks wrap the front and both building sides.
- A rounded grass verge separates the outer row from a five-foot public sidewalk.
- A 24-foot driveway at the right reaches the street without a raised curb across it.
- Five existing cars occupy actual spaces, and the two lamps stand in the verge.

`parking-layout.ts` is the shared dimension and placement source;
`parking-lot.ts` batches static surfaces by material. No per-frame work or new
external assets are introduced. The high-quality commercial backdrop moves its
opposite sidewalk, parking and shops together when the street moves. Lower
quality retains its existing sky and omits that commercial model.

Run `npm run check`. The layout tests cover several store widths and walkway
depths, pavement bounds, both side aisles and the unobstructed ramp and driveway.
Render proof should include a plan overview, an entrance view and a phone viewport.
