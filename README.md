# ATELIER — 3D perfume showroom

A static showroom for Rose Lune and Galet. Scroll from the collection into Galet and Rose Lune, or tap either bottle to go straight to it. The bottles sit on staggered studio plinths in front of a muted Seedance 2.5 video loop. Hidden studio lighting and a short product turn accompany each camera move. Drag directly on the close-up bottle to turn it, or open the 3D viewer for drag rotation and pinch or wheel zoom.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Rose Lune uses a reworked [Grab3D Perfume Bottle](https://grab3d.com/models/props/perfume-bottle/). The source is CC0. The ATELIER version uses pink crystal and perfume, an obsidian cap, and a new rose-gold collar.
- Galet uses the supplied Higgsfield Tripo model, simplified for mobile with its original texture maps. The showroom turns the original label toward the camera and gives each bottle a focused studio light during its close-up. The older procedural Galet model is kept in the source files.
- To rebuild the original GLBs, download the stock Grab3D GLB and run `blender -b --python build-bottles.py -- /path/to/perfume-bottle.glb .` with Blender 4.3.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.
