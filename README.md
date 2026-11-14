# ATELIER — 3D perfume showroom

A static showroom for Rose Lune and Galet. Choose a bottle in the collection or scroll between fragrances. Each flacon sits inside a physically recessed stone shelf. A perspective camera moves toward the chosen shelf as its overhead light brightens. The product details include an interactive viewer with drag rotation and pinch or wheel zoom.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Rose Lune uses a reworked [Grab3D Perfume Bottle](https://grab3d.com/models/props/perfume-bottle/). The source is CC0. The ATELIER version uses pink crystal and perfume, an obsidian cap, and a new rose-gold collar.
- Galet is an original smooth mesh with a rounded rectangular glass flacon, green perfume, and a polished ivory cap. Its printed label is drawn as a texture in the showroom.
- To rebuild both GLBs, download the stock Grab3D GLB and run `blender -b --python build-bottles.py -- /path/to/perfume-bottle.glb .` with Blender 4.3.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.
