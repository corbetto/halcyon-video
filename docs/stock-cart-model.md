# Stock cart

Original Blender construction in `tools/models/release-cart.py` and the editable
`release-cart.blend`; runtime export is `public/models/release-cart.glb`.
Each tray is one closed folded sheet with a solid floor, inside walls and rolled
edges. The upper and lower support surfaces remain at 2.55 and 0.9 feet.

The shared case pipeline displays 48 mixed catalog titles in small stacks.
Suggestions and unowned placeholders are excluded. Each store build chooses a
random placement that passes the existing layout validator, preserving room and
fixture clearance. The collision proxy and navigation footprint follow that
placement. Loading failure preserves a solid built-in cart.
