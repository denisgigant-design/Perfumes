# ATELIER — 3D perfume showroom

The showroom features **Galet**, **Rose Lune**, **Sillage Bleu**, and **Ambre Doré**. The bottles sit in a dark basalt wall with four niches across on desktop and a two-by-two layout on phones. Scroll through the four camera positions, or select a bottle to fly into its niche and play a 360° turn. Drag to rotate the bottle or open the separate 3D viewer.

The updated GLBs contain high-resolution labels, and Sillage Bleu uses a transmissive glass cap. The browser shader uses the liquid mesh to estimate an optical volume with colour absorption and a moving liquid line. The water shader stretches and distorts a planar scene reflection, with moving highlights beneath the overhead spotlights. Mobile rendering gives the main canvas a higher pixel budget than the water reflection pass.

The WebGL scene generates the stone surround and lights it with overhead spots and coloured spill. The stone surfaces use the generated basalt texture. Each recess has a ceiling fixture, coloured spill on both sides, and a refracted light pool beneath the bottle. The glass uses richer product colours and polished highlights above a higher-resolution rippling water reflection. Each GLB includes a sharp lossless label sized for its physical print surface. Browsers without WebGL 2 display generated stone environments and bottle previews.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Rose Lune uses the assembled perfume bottle extracted from the supplied OBJ. The web GLB has separate glass, liquid, atomizer and label meshes. Ambre Doré uses the supplied bottle geometry with a clear cap, amber glass, and gold hardware. The original OBJ referenced a separate MTL file, so its finishes were recreated from the requested colours.
- Galet uses a custom crystal model based on the supplied green bottle. It has a separate liquid mesh, a pearlescent cap and the printed Galet label. Sillage Bleu is a custom tall cobalt glass GLB with a fluted cap, a separate liquid mesh and its own label artwork.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.
