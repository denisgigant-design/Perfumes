# Research ledger — cinematic fragrance websites and 3D implementation

Research index of **56 distinct web pages** surfaced in targeted searches on November 14, 2026, grouped by role. The most directly relevant implementation pages were examined in detail. The wider list is a source directory, **not** a claim that every brand site uses Three.js or that every individual page received a full visual audit.

## Findings applied to the build

- **Build the composition in layers.** Treat the architectural stone niches, shadows, spotlight glow, perfume photography, 3D mesh and type as separately controllable visual planes rather than making the whole website a single flattened image. See Codrops atmospheric depth gallery and scroll-revealed WebGL gallery.
- **One polished camera language, not a dozen flashy effects.** A gallery-to-close-up transition with easing, pinned scrolling, and product-specific light colours is closer to the reference than generic card animations. See Codrops camera path tutorial and GSAP ScrollTrigger.
- **Keep real 3D optional in the main view.** Images give reliable visual fidelity and fast loading. Actual GLB models allow rotation and zoom on demand. Three.js GLTFLoader supports local GLB assets. Materials can use transmission, roughness, clearcoat, thickness and IOR for glass. See Three.js and Khronos.
- **Responsive layout needs an art-directed mobile composition.** Rearrange the two niches and product text, rather than scaling the same screenshot down. See MDN CSS transforms and reduced-motion guidance.
- **License models properly.** Multiple public downloadable perfume models exist, including the Grab3D CC0 bottle. The hosted model could not be fetched into the working environment, so the deliverable uses *original procedurally authored GLBs* instead; no third-party model copyright is required. Each original file is bundled locally.
- **Account for motion accessibility and failures.** CSS handles visual transitions; JS handles state and scroll. Reduced-motion is respected. WebGL2 or GLB loading failures yield a 2D image fallback rather than a broken black frame; no external Three.js runtime is required.

## Web references (56 pages)

### Editorial motion and creative-development examples

1. [Codrops — Scroll-reactive 3D gallery, depth and mood](https://tympanus.net/codrops/2026/03/09/building-a-scroll-reactive-3d-gallery-with-three-js-velocity-and-mood-based-backgrounds/)
2. [Codrops — Scroll-revealed WebGL gallery](https://tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js/)
3. [Codrops — 3D camera path with Three.js and GSAP](https://tympanus.net/codrops/2026/07/07/building-a-scroll-driven-3d-gallery-using-a-blender-camera-path-with-three-js-and-gsap/)
4. [Codrops — 3D image rotation during scroll](https://tympanus.net/codrops/2026/06/18/exploring-3d-image-rotations-on-scroll/)
5. [Codrops — On-scroll 3D carousel](https://tympanus.net/codrops/2025/05/07/on-scroll-3d-carousel/)
6. [Codrops — Creative hub](https://tympanus.net/codrops/hub/)
7. [Codrops — Tutorials hub](https://tympanus.net/codrops/hub/tutorials/)
8. [Codrops — GSAP demo highlights](https://tympanus.net/codrops/hub/gsap-highlights/)
9. [Codrops — All demos](https://tympanus.net/codrops/hub/all/)

### Animation, transitions, and scroll

10. [GSAP — ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
11. [GSAP — Flip](https://gsap.com/docs/v3/Plugins/Flip/)
12. [GSAP — Observer](https://gsap.com/docs/v3/Plugins/Observer/)
13. [GSAP — ScrollToPlugin](https://gsap.com/docs/v3/Plugins/ScrollToPlugin/)
14. [Lenis — Project](https://github.com/darkroomengineering/lenis)
15. [Lenis — README and GSAP integration](https://github.com/darkroomengineering/lenis/blob/main/README.md)

### Three.js and WebGL rendering

16. [Three.js — GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
17. [Three.js — Loading 3D models guide](https://threejs.org/manual/pages/loading-3d-models.html)
18. [Three.js — Loading glTF guide](https://threejs.org/manual/pages/load-gltf.html)
19. [Three.js — RoomEnvironment](https://threejs.org/docs/pages/RoomEnvironment.html)
20. [Three.js — MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html)
21. [Three.js — MeshPhysicalMaterial (archived API)](https://archive.threejs.org/docs/api/en/materials/MeshPhysicalMaterial.html)
22. [Three.js — EffectComposer](https://threejs.org/docs/pages/EffectComposer)
23. [Three.js — Live examples index](https://threejs.org/examples/)
24. [Three.js — Unreal bloom example](https://threejs.org/examples/webgl_postprocessing_unreal_bloom.html)
25. [React Three Fiber — Example gallery](https://r3f.docs.pmnd.rs/getting-started/examples)
26. [R3F Example showcase](https://r3f-examples.donjor.net/)
27. [Google — model-viewer](https://developers.google.com/ar/develop/webxr/model-viewer)
28. [Three.js GLTFLoader archived reference](https://munrocket.github.io/three.js/docs/examples/en/loaders/GLTFLoader.html)

### glTF format, interoperability and export

29. [Khronos — glTF registry](https://registry.khronos.org/glTF/)
30. [Khronos — Sample asset viewer](https://github.khronos.org/glTF-Assets/)
31. [Khronos — glTF repository](https://github.com/KhronosGroup/glTF)
32. [Khronos — glTF 2.0 specification](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/README.md)
33. [Khronos — glTF sample models](https://github.com/KhronosGroup/glTF-Sample-Models)
34. [Khronos — glTF sample assets](https://github.com/KhronosGroup/glTF-Sample-Assets)
35. [Khronos — glTF assets website repository](https://github.com/KhronosGroup/glTF-Assets)
36. [Khronos — WebGL PBR sample viewer](https://github.com/KhronosGroup/GLTF-Sample-Viewer)
37. [Blender — Latest glTF export manual](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html)
38. [Blender — glTF exporter and alpha blending reference](https://docs.blender.org/manual/en/2.82/addons/import_export/scene_gltf2.html)

### Perfume models, textures and licensing

39. [Grab3D — CC0 perfume bottle](https://grab3d.com/models/props/perfume-bottle/)
40. [Sketchfab — Giulia Giaretta perfume bottle CC BY](https://sketchfab.com/3d-models/perfume-bottle-b5aa95da66294344a3fdc56e38873cec)
41. [Sketchfab — Michaela Blanchfield perfume bottle CC BY](https://sketchfab.com/3d-models/perfume-bottle-31303f93f4ec4da796180aa751885a1d)
42. [Sketchfab — Another perfume bottle by M. Blanchfield](https://sketchfab.com/3d-models/perfume-bottle-7fb074117e104c5280e7360bce962267)
43. [Sketchfab — ChristyMathews perfume bottle](https://sketchfab.com/3d-models/perfume-c66ebff390eb4790a836d2f3d5054874)
44. [Sketchfab — Pankaj perfume bottle](https://sketchfab.com/3d-models/perfume-bottle-3d-model-by-pankaj-16bc371923e1456ba9245170e33d7475)
45. [Pixabay — GLB perfume bottle](https://pixabay.com/3d-models/glb-perfume-bottle-glass-vial-4060/)
46. [Innerscene — CC0 cosmetic dropper GLB](https://www.innerscene.com/tools/library/3d-parts/cosmetic-glass-dropper-bottle-30-ml-d40b4f94)
47. [Innerscene — CC0 scent diffuser GLB](https://www.innerscene.com/tools/library/3d-parts/quiet-scent-home-accessory-645e5159)
48. [BlendSwap — Perfume bottles](https://blendswap.com/3d/perfume-bottle)
49. [Poly Haven — CC0 textures and HDRIs](https://polyhaven.com/)
50. [Poly Haven — Studio HDRI](https://polyhaven.com/a/poly_haven_studio)

### Actual luxury perfume storefront references

51. [Frédéric Malle](https://www.fredericmalle.com/)
52. [Xerjoff](https://www.xerjoff.com/)
53. [Kilian Paris](https://www.bykilian.com/)
54. [Maison Margiela — Fragrances](https://www.maisonmargiela.com/en-gb/maison-margiela/women/fragrances/)
55. [Amouage](https://amouage.com/)
56. [Xerjoff — Catalog](https://www.xerjoff.com/collections/xerjoff-perfumes)

### Additional UX and performance resources (not counted above)

- [MDN — Reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion)
- [MDN — CSS performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS)
- [MDN — CSS transforms](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Transforms)
