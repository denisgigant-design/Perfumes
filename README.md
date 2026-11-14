# ATELIER — 3D perfume showroom

The showroom features **Galet**, **Rose Lune**, **Sillage Bleu**, and **Ambre Doré**. Scroll to fly between four camera checkpoints. The platforms are fixed and each bottle gently floats and tilts. Tapping a bottle takes you into its brighter close-up and plays its own 360° turn. Drag to rotate it or open the separate 3D viewer.

The updated GLBs contain high-resolution labels, and Sillage Bleu uses a transmissive glass cap. The browser shader uses the liquid mesh to estimate an optical volume with colour absorption and a moving liquid line. The water shader stretches and distorts a planar scene reflection, with moving highlights beneath the overhead spotlights. Mobile rendering gives the main canvas a higher pixel budget than the water reflection pass.

The background combines a darkened Seedance studio plate with [Side Rays from React Bits](https://reactbits.dev/c/backgrounds/side-rays). Both the rays and the scene lighting respond to pointer movement.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Rose Lune uses the assembled perfume bottle extracted from the supplied OBJ. The web GLB has separate glass, liquid, atomizer and label meshes. Ambre Doré uses the supplied bottle geometry with a clear cap, amber glass, and gold hardware. The original OBJ referenced a separate MTL file, so its finishes were recreated from the requested colours.
- Galet uses a custom crystal model based on the supplied green bottle. It has a separate liquid mesh, a pearlescent cap and the printed Galet label. Sillage Bleu is a custom tall cobalt glass GLB with a fluted cap, a separate liquid mesh and its own label artwork.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.
