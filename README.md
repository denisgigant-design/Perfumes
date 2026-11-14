# ATELIER — 3D perfume showroom

A static, three-fragrance showroom for **Galet**, **Rose Lune** and **Sillage Bleu**. The collection begins with Galet in the foreground. Scrolling moves through Galet, Rose Lune and Sillage Bleu. Tapping a bottle takes you into its close-up and plays one 360° rotation. The bottles gently move at idle and can be dragged to look around them in the close-up. The separate 3D viewer supports drag, pinch and wheel zoom.

The background layers [Side Rays from React Bits](https://reactbits.dev/c/backgrounds/side-rays) over the silent Seedance 2.5 studio loop. The shader is adapted for the site's existing standalone JavaScript setup and follows pointer movement and the active fragrance. The bottle key lights and colour on the platform react to the same pointer movement. The React Bits license is included in `LICENSE-react-bits.txt`. The fixtures are outside the camera frame. The coloured patterns on the platform are animated caustic approximations tied to the rotation of each bottle. The materials use a separate inner liquid mesh under a transmissive glass shell. The site respects the device's reduced-motion preference.

## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Rose Lune uses the assembled perfume bottle extracted from the supplied OBJ. The web GLB has separate glass, liquid, atomizer and label meshes. Materials were authored for the site because the OBJ's companion MTL was absent.
- Galet uses a custom crystal model based on the supplied green bottle. It has a separate liquid mesh, a pearlescent cap and the printed Galet label. Sillage Bleu is a custom tall cobalt glass GLB with a fluted cap, a separate liquid mesh and its own label artwork.
- The bundled renderer uses Three.js r170, its GLTFLoader, and RoomEnvironment. Its MIT license is included in `LICENSE-three.txt`.
