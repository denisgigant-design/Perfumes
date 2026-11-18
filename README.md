# ATELIER — 3D perfume showroom

Five tall basalt recesses display Galet, Rose Lune, Iris Noir, Terre Fumée and Nacre. Portrait phones display two above three. Desktop displays a single row. Select a fragrance to move into its recess, turn on its white inspection light and play one opening spin. Drag or use the trackpad to rotate it. Activate the bottle again to return. On portrait screens the close-up frames the product below the niche ceiling.

The glass shader uses a 95% fill target calibrated for each body profile. Dragging or rotating tilts the liquid surface, which settles when movement stops. The water shader creates darker planar reflections with layered ripples around the moving highlights beneath the overhead spotlights. A soft local shade behind the collection title keeps the white lettering readable. Mobile rendering gives the main canvas a higher pixel budget than the water reflection pass.

The facade receives a grazing key from the far upper left. Its static shadow map updates on layout changes. A recessed downlight in each niche combines a feathered spot on the relief with a soft shaft of haze. A low bounce light uses the perfume colour. Selecting a bottle adds white inspection light through the same aperture. The glass uses transmission, colour absorption and asymmetric strip reflections.


## Run locally

Run `python3 -m http.server 8000` from the repository root and open http://localhost:8000. GitHub Pages serves the same root directly. No runtime build or package installation is needed. Browsers without WebGL 2 use the included bottle images.

The bag is a local demo. It saves quantities on the device and does not process payments.

## Models and renderer

- Galet and Rose Lune retain their original glass, liquid, cap and printed label assets.
- Three original GLBs add fluted Iris Noir with a banded stopper, the tall tobacco-glass Terre Fumée with a brushed gun-gold cap, and Nacre with its polished open ring. Each contains a dedicated reservoir and an embedded printed label.
- The bundled renderer uses Three.js r170, its GLTFLoader, and a locally generated studio reflection map. Its MIT license is included in `LICENSE-three.txt`.

## Stone material

The local `cleaved-rock-*.webp` assets derive from [Rock Face 03](https://polyhaven.com/a/rock_face_03), photographed by Dario Barresi and processed by Rico Cilliers, CC0. The charcoal colour map, tangent-space normal map and packed height/roughness map share UV coordinates. Height displaces the mesh while the normal map retains finer cracks under moving light.
