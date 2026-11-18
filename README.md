# ATELIER — 3D perfume showroom

Five tall basalt recesses display Galet, Rose Lune, Iris Noir, Terre Fumée and Nacre. Portrait phones display two above three. Desktop displays a single row. Select a fragrance to move into its recess, turn on its white inspection light and play one opening spin. Drag or use the trackpad to rotate it. Activate the bottle again to return. On portrait screens the close-up frames the product below the niche ceiling.

The glass shader uses a 95% fill target calibrated for each body profile. Dragging or rotating tilts the liquid surface, which settles when movement stops. The water shader creates darker planar reflections with layered ripples around the moving highlights beneath the overhead spotlights. A soft local shade behind the collection title keeps the white lettering readable. Mobile rendering gives the main canvas a higher pixel budget than the water reflection pass.

The WebGL scene generates the stone surround and lights it with overhead spots and coloured spill. The stone surfaces use the generated cleft basalt texture in `basalt-cleft.jpg`, with continuous world-space UVs, shallow surface relief, and a separate roughness response. Each recess has one cut-stone opening with uninterrupted reveals. The surrounding stone is darker than the illuminated interiors. Each recess uses the same stone on its rear and side walls, a round white downlight and a second white inspection lamp on selection, coloured spill on both sides, and a refracted light pool beneath the bottle. Each bottle has an equally positioned front light and consistent matte printed labels. The wall extends to the top of the viewport, with fragrance names shown on selection. The glass uses richer product colours and polished highlights above a higher-resolution rippling water reflection. Each GLB includes a sharp lossless label sized for its physical print surface. Browsers without WebGL 2 display generated stone environments and bottle previews.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Galet and Rose Lune retain their original glass, liquid, cap and printed label assets.
- Three original GLBs add fluted Iris Noir with a banded stopper, the tall tobacco-glass Terre Fumée with a brushed gun-gold cap, and Nacre with its polished open ring. Each contains a dedicated reservoir and an embedded printed label.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.

## Stone material

`basalt-cleft.jpg` was generated with the built-in image-generation tool for this project. Prompt: seamless orthographic macro photograph of freshly cleaved dark anthracite basalt and slate, small mineral facets, irregular fractures and fine grain, neutral charcoal, flat diffuse lighting, edge-to-edge stone, no objects, text, large boulders, lighting gradients or repeated pattern.
