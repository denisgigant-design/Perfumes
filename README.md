# ATELIER — five-bottle interactive perfume showroom

A responsive static website built with HTML, CSS, JavaScript and bundled Three.js. No framework or build step.

## The two supplied backgrounds

The desktop scene keeps the supplied five-in-a-row carved rock alcoves. The mobile scene keeps the 2-over-3 layout. Their rock formations, framing and still-water surfaces are preserved. Only the fifth niche's original pink lighting/reflection has been colour-graded to blue to match the newly supplied blue-and-gold bottle.

## Products and behaviour

1. Ambre Doré — €80 — 3D GLB model
2. Rose Lune — €75 — 3D GLB model
3. Galet — €95 — 3D GLB model
4. Sillage Bleu — €60 — 3D GLB model
5. Bleu Royal — €60 *temporary demo price* — the user's transparent PNG, used as a **static image only**, with **no 3D spin**.

Click or tap a product to open a close-up that preserves the full niche. Coloured glow, top lighting, and water reflection brighten for the selected product. The four GLBs make a single complete 360-degree rotation on selection and settle; the photo stays completely still. The pointer-following light reacts to mouse/trackpad movement and finger touching/dragging. The image/photo fallback stays usable when WebGL is unavailable.

The basket remembers item quantities in localStorage; no checkout or payments are connected. The product prices are demonstrations, not verified retail prices. To adjust the fifth price, modify `price` on the `photo` item in `app.js`.

## Run it

All files are placed directly beside `index.html` (no `assets/` folder). At the extracted folder root, start a local server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. For GitHub Pages, upload everything in this folder to the repository root and enable Pages to deploy from the root of the default branch. The site uses no build tools. Google Fonts is optional and has local fallback fonts.

## Files

- `index.html`: minimal page structure, modal product view and basket
- `style.css`: exact responsive scene placement, pointer light and visual styling
- `app.js`: product data, 3D initialization, pointer/touch effects and basket
- `three-showroom.js`: bundled Three.js and GLTFLoader code
- The four GLBs, photo-only PNG, image fallbacks, scene photographs and close-up photo crops are in the same root directory as `index.html`.

The site was checked with JavaScript syntax validation and in-browser fallback tests for desktop and mobile layouts, including five product hit targets, the static photo close-up, the 3D product selection path and basket arithmetic. GPU WebGL rendering was not visually verified in this environment.

**GitHub upload:** Extract the ZIP, select all individual files and upload them together to the repository root using **Add file → Upload files**. Do not upload the ZIP itself; no directory creation is needed.
