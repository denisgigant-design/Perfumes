# ATELIER — restored continuous five-fragrance showroom

**Files are deliberately flat:** upload every file directly into the GitHub repository root (next to `index.html`). There is **no assets folder**, build step, package manager, or server-side dependency. GitHub Pages can serve `index.html` from the repository root.

## Design and motion

- The exact supplied desktop (`scene-desktop.png`, 1536 × 864) and portrait mobile (`scene-mobile.png`, 864 × 1536) images remain the background and never switch into a cropped screenshot or independent product page.
- Four original GLB models are preserved unchanged: `ambre-dore.glb`, `rose-lune-smoked.glb`, `galet-crystal.glb`, and `sillage-bleu.glb`.
- `bleu-royal-photo.png` is the supplied **static, transparent fifth bottle**. It is **never spun as a 3D object**.
- The user can click any bottle for a direct camera flight to its niche, or scroll / swipe up the page to pass through all five positions. A click moves the scroll checkpoint instantly, then animates the same world into focus. No modal product image or separate scene is shown.
- Colored ambient pools and downlights intensify for the current product, with subtle water distortion/reflection. No touch-following / mouse-following light.
- Product copy, price, add-to-basket, and back-to-gallery appear as a minimal dock over the continuous experience.
- The basket is a local demonstration saved in localStorage; no payments, shipping, or checkout are connected.

## Test and troubleshoot

Test on GitHub Pages or a local HTTP server (for example `python3 -m http.server 8000`). JavaScript modules and GLBs require HTTP/HTTPS; opening `index.html` from `file://` may block assets in some browsers. WebGL-capable browsers render the GLB models; when WebGL is disabled, 2D bottle PNG previews are displayed instead. To see whether GLBs loaded, look for the `webgl-ready` class on the first four bottle image fallbacks and inspect the browser console.

The restored site uses a local Three.js r170 bundle (`three-showroom.js`) under its included MIT license. Google Fonts loads only when internet is available and falls back to system fonts.
