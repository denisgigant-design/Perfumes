# ATELIER — Real-time 3D perfume showroom

A concept website based on the supplied luxury-fragrance showroom motion reference, featuring **two genuinely three-dimensional original GLB perfume bottles**, a separate shelving background, animated scene transitions and a drag-to-rotate inspection view. This is an independent demo, not an official perfume shop.

## Open the website

1. Extract `atelier-perfume-3d.zip`.
2. Keep `index.html` and the `assets` folder together.
3. Upload `index.html` and `assets/` to any static host (GitHub Pages, Netlify, etc.). **No build or npm install required.**
4. For local desktop testing, from the extracted folder run `python -m http.server 8000` and open `http://localhost:8000`.

Opening the HTML directly as a `file://` URL may block loading GLBs in some browsers; serving it over HTTP or HTTPS is recommended.

## What was corrected

- Green perfume bottle rebuilt as a true faceted **3D model** with a rounded glass body, pale green liquid, metal collar, pearlescent cap, and a clean original textured label.
- Pink perfume bottle also uses its own **original 3D mesh** with a rounded body and black spherical cap.
- Both GLBs render **in the main collection and product close-up**, not only in a popup. The same actual model moves between scene positions and smoothly scales up.
- In the interactive viewer, drag to rotate the GLB. Both models and their embedded label textures are included locally.
- Uses a lightweight **native WebGL2 glTF/GLB renderer**, with approximated glass, polished-metal highlights, per-product colour lighting, and easing. It **does not depend on external Three.js/CDN scripts**. Google Fonts is the only optional external resource.
- Separate dark shelving artwork remains behind the live 3D models; bottle PNGs are used *only if WebGL2 is unsupported / GLB load fails*, and as cart thumbnails.
- Scroll-driven gallery → Rose Lune → Galet transitions, touch swipe, navigation controls, reduced-motion handling, and mobile layout.

## Included files

```
index.html                          Homepage, interface, CSS & UI transitions
assets/showroom-webgl.js           Native WebGL2 GLB loader, shaders & animation
assets/rose-lune.glb               Original real 3D bottle, label embedded
assets/galet.glb                   Original real 3D bottle, label embedded
assets/rose-lune.png               2D fallback / cart thumbnail
assets/galet.png                   2D fallback / cart thumbnail
assets/rose-lune-label.png         Editable label artwork
assets/galet-label.png             Editable label artwork
assets/shelving.jpg                Separate 2D shelving backdrop
RESEARCH.md                        Research ledger
```

## Important boundaries

This is a **functional static concept**, not a completed production commerce system. Cart state is local only and payment processing is not connected. Model glass/reflections use realtime WebGL shader approximation rather than offline raytraced or pathtraced refraction. GLB models are procedurally authored originals (not externally licensed commercial perfume scans).

JavaScript parsing and GLB container integrity were checked. The testing browser in this environment blocked opening even local pages, so the actual rendering appearance and interactions **could not be visually verified here**. Test the extracted site on the target device before publishing. If a device lacks WebGL2, it displays the fallback PNG assets.
