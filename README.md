# ATELIER — 3D perfume showroom

A four-fragrance showroom for **Galet**, **Rose Lune**, **Sillage Bleu**, and **Ambre Doré**. Scrolling turns the camera through a continuous full orbit around the collection. The four checkpoints move along the same path. Tapping a bottle opens its close-up in place and starts a 360° spin. Scroll to resume the orbit from where you left it, or drag the bottle to rotate it in the close-up.

An animated water shader distorts a planar reflection of the bottles and raised platforms. Tapping a product increases its hidden key and coloured rim lights, along with the corresponding water highlights. The platforms have four subtly different profiles and a fine bump texture. The background uses the darkened Seedance studio plate and [Side Rays from React Bits](https://reactbits.dev/c/backgrounds/side-rays). Phone-sized views use a bounded pixel ratio and a smaller, throttled reflection pass to keep the main bottle render sharp.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Rose Lune uses the assembled perfume bottle extracted from the supplied OBJ. The web GLB has separate glass, liquid, atomizer and label meshes. Ambre Doré uses the supplied bottle geometry with a clear cap, amber glass, and gold hardware. The original OBJ referenced a separate MTL file, so its finishes were recreated from the requested colours.
- Galet uses a custom crystal model based on the supplied green bottle. It has a separate liquid mesh, a pearlescent cap and the printed Galet label. Sillage Bleu is a custom tall cobalt glass GLB with a fluted cap, a separate liquid mesh and its own label artwork.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.
