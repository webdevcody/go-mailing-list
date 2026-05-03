# Budgets & Format Matrix

Loaded by SKILL.md Phase 4 only. The audit phases before this don't need it.

## Surface budgets

Pick a surface per image based on its slot in the layout, then apply the budget.

| Surface | Typical max CSS width | Export cap (2× DPR) | Byte budget |
| --- | --- | --- | --- |
| Full-bleed hero / LCP | 1200–1440 px | 1920 px | ≤ 250 KB |
| Half-width feature shot | 560–720 px | 1280 px | ≤ 180 KB |
| Card / grid image | 280–400 px | 800 px | ≤ 80 KB |
| Avatar / testimonial | 48–96 px | 192 px | ≤ 24 KB |
| Inline icon (raster) | 16–48 px | 96 px | ≤ 8 KB (prefer SVG) |

Rules:

- **Resize formula:** `target_width = min(source_width, ceil(slot_max_css_px × 2))`, then cap at the surface's export cap.
- A motion/parallax effect can justify going above the cap — note it explicitly in the finding.
- If the image carries small UI text, allow a slightly larger WebP rather than dropping to AVIF and blurring.

## Format decision

```
Vector / logo / icon ────────────────────────────► SVG
Photo / gradient marketing visual ──────────────► AVIF (fallback WebP)
Screenshot / UI capture / mixed ────────────────► WebP
Needs exact transparency, WebP unacceptable ───► PNG (still resize + quantize)
Pixel-art or hard-edge fidelity required ──────► PNG
```

Encoder starting points (only when the tool exposes quality):

- AVIF: quality 45–55
- WebP: quality 60–75
- PNG: max compression, palette where possible

## When to flag vs. skip

Flag (write a finding):

- Raster image > 2× its slot
- PNG/JPG screenshot or photo with no transparency
- Any file over its surface byte budget
- Missing `width`/`height` on a non-decorative image
- Missing `sizes` on anything larger than a card surface
- Zero or multiple `priority` images on the page
- Below-the-fold image without `loading="lazy"`
- Decorative image with non-empty `alt` or content image with empty `alt`

Skip silently:

- SVG icons under ~10 KB
- Files at or under their surface budget AND within 2× of slot AND in a modern format
- `REMOTE` images already noted in Phase 2 (covered separately in the report)

## Estimation hints (for the ranked fix list)

Rough byte-savings estimates, marked as estimates in the report:

- **Resize-only (raster):** new bytes ≈ current bytes × (target_width / current_width)²
- **PNG → WebP at correct size:** ~50–70 % reduction at the same dimensions
- **JPG → AVIF at correct size:** ~30–50 % reduction at the same dimensions
- **Compress-only at correct size and format:** 10–30 %

Use the upper bound of the range only when the source is clearly under-compressed. Otherwise use the midpoint.
