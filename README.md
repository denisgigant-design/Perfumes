# ATELIER — 3D perfume showroom

A static, three-fragrance showroom for **Galet**, **Rose Lune** and **Sillage Bleu**. The collection begins with Galet in the foreground. Scrolling moves through Galet, Rose Lune and Sillage Bleu. Tapping a bottle takes you into its close-up and plays one 360° rotation. The bottles gently move at idle and can be dragged to look around them in the close-up. The separate 3D viewer supports drag, pinch and wheel zoom.

The background is an eight-second Seedance 2.5 studio plate exported as a silent, reversing loop. The fixtures are outside the camera frame. The coloured patterns on the platform are animated caustic approximations tied to the rotation of each bottle. The materials use a separate inner liquid mesh under a transmissive glass shell. The site respects the device's reduced-motion preference.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Rose Lune uses a reworked [Grab3D Perfume Bottle](https://grab3d.com/models/props/perfume-bottle/). The source is CC0. The ATELIER version uses pink crystal and perfume, an obsidian cap, and a new rose-gold collar.
- Galet uses a custom crystal model based on the supplied green bottle. It has a separate liquid mesh, a pearlescent cap and the printed Galet label. Sillage Bleu is a custom tall cobalt glass GLB with a fluted cap, a separate liquid mesh and its own label artwork.
- To rebuild the original GLBs, download the stock Grab3D GLB and run `blender -b --python build-bottles.py -- /path/to/perfume-bottle.glb .` with Blender 4.3.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.
