# Dennis’s Shop — Unveiled Collection

Five-bottle luxury basalt showroom. The files in this package are **all at the root level**, ready to upload individually in GitHub using **Add file → Upload files**. `index.html` is lowercase. Do not upload the ZIP itself as a site file; extract it first. GitHub Pages must be configured to deploy from the default branch, root (`/`).

## Experience

- Five photographic niches, preserving the source rough-rock layouts: five in a row on desktop, two above three on phones.
- The scene, reflection floor, and rock all extend beyond the edges, including on close-up. There are no separate screenshots or product pages.
- Four original, unchanged GLB model files (Amber Doré, Rose Lune, Galet, Sillage Bleu) with restored native saturated glass and liquid. The script no longer uses the previous secondary refraction shader which caused stippled overlays. A soft spotlight and coloured back/rim lights highlight the selected bottle.
- Fifth **Bleu Royal** uses the supplied transparent blue-and-gold PNG as an intentionally static photo; it does not spin.
- Wheel and touch navigation snap to the gallery and five exact product checkpoints, no halfway holding positions. Direct tap/click flies to a product in the same environment. GLB bottles turn once on selection and can be manually rotated horizontally.
- Product names display beneath gallery niches and only in the bottom gradient dock when focused. The dock shows the product description, price, a symbolic Fruit of the Spirit pairing, and the add-to-basket action.
- Coloured water highlights, soft ripple movement and continued rough stone surround. Blue and green ambient panels are graded from the user's original images, preserving their physical texture and niche geometry. No touch-follow light or particle-dot layer.
- Basket stores local demo quantities only; no real payment checkout is integrated.

## Prices and five illustrative fruit pairings

| Perfume | Price | Fruit of the Spirit |
| --- | ---: | --- |
| Ambre Doré | €80 | Joy |
| Rose Lune | €75 | Love |
| Galet | €95 | Kindness |
| Sillage Bleu | €60 | Peace |
| Bleu Royal | €60 (placeholder) | Faithfulness |

The pairings are creative merchandising labels, not a theological equivalence. The fifth bottle's €60 is a placeholder until an exact fifth price is supplied.

## Verification and limitations

- HTML/CSS/JS paths resolve from repository root, with no folder nesting.
- The four GLB files are unchanged from the prior original model set.
- Automated desktop/mobile interaction tests passed: gallery, all 5 click targets, snap to exact checkpoint, captions, backdrop, prices and basket totals.
- The automated local browser did **not** provide a WebGL context. The screenshots from that browser show the improved 2D fallbacks, not the finished live 3D graphics. Real-time glass and cap appearance must be visually checked in a WebGL-capable browser on GitHub Pages. A browser with no WebGL shows the cleaned PNG fallbacks.
