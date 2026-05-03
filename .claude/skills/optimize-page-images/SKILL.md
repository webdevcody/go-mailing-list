---
name: optimize-page-images
description: Audit every image referenced by a single UI page/route to find concrete optimization wins — oversized source files vs. rendered slot, wrong format (PNG/JPG that should be WebP/AVIF), missing width/height/sizes/priority, missing lazy-load, files over per-surface byte budgets. Reads each image from disk to get real dimensions and bytes; produces a per-image findings table with specific fixes (resize to N px, convert to WebP, compress to ≤K KB, add sizes, mark priority). Trigger phrases — "audit images on this page", "optimize images for web", "tinypng this page", "scale these images down", "convert to webp", "why is this page slow", "find oversized images", "image audit", "/optimize-page-images", "look for image optimizations". Skip for — runtime/CDN-transformed user-uploaded media (the source isn't in the repo), single-image tweaks (just edit it), or full Core Web Vitals audits beyond images (use a perf skill).
---

# Audit Page Images

Scan one page, measure every image it references on disk, report per-image fixes. **Report first, fix only after the user picks which to apply.**

The agent's job is to produce *measurements the user can't easily get themselves* — actual file bytes, actual pixel dimensions, the gap between source size and rendered slot. Not generic advice.

---

## Phase 1 — Locate the target page

**Exit condition:** one specific source file identified as the page under audit.

- If the user named a route or file, use it directly.
- If they said "this page" with no file open, ask which one.
- If they pointed at a component (not a route), audit that component's file plus any image-bearing children it imports directly. Do not recurse the whole tree.

State the resolved path back before continuing.

---

## Phase 2 — Enumerate image references

**Exit condition:** a list of every image reference with its resolved on-disk path (or marked `REMOTE` / `DYNAMIC`).

In the page file (and components it directly renders), find every:

- `<img src="...">` and `<Image src="...">` (Next.js, TanStack, etc.)
- Framework-specific responsive components (`ResponsiveImage`, `Picture`, etc.)
- `import logo from "./foo.png"` style imports used as `src`
- CSS `background-image: url(...)` in colocated styles
- `<source srcSet="...">` inside `<picture>`

For each reference, resolve the actual file:

- `/foo.png` → `public/foo.png` (or framework equivalent)
- `./foo.png` import → relative to the importing file
- `https://...` → mark `REMOTE`, do not try to fetch
- Template strings / props with runtime values → mark `DYNAMIC`, note the prop name
- Barrel re-export (`./images/index.ts`) or typed CMS object (`{ src, width, height }`) → follow the type to its concrete file before classifying

`REMOTE` and `DYNAMIC` images are listed but skipped from the disk-measurement phase. Surface them in the report as "not auditable from source — verify CDN transform / runtime sizing."

---

## Phase 3 — Measure each image on disk

**Exit condition:** every resolved local image has `{path, format, width_px, height_px, bytes}` recorded.

Use a single command per image. `sips` (macOS, preinstalled) or `identify` (ImageMagick) work for raster; SVG just needs `wc -c` for bytes plus a quick read for `viewBox`.

```bash
# raster — pixel dimensions
sips -g pixelWidth -g pixelHeight <path>
# bytes
stat -f%z <path>      # macOS
stat -c%s <path>      # Linux
```

Batch the calls — one Bash invocation that loops over the file list, not one per image.

If a measurement fails (corrupt file, unknown format), record the error and continue. Do not abort the whole audit.

---

## Phase 4 — Determine the rendered slot for each image

**Exit condition:** for each image, a `slot_max_css_px` estimate and a surface classification (hero / feature / card / avatar / icon / decorative).

Read it from the JSX, not from intuition:

- Tailwind width classes on the `<img>` or its parent (`max-w-7xl`, `w-32`, `aspect-video`, etc.)
- `width=`/`height=` attributes
- Existing `sizes` attribute (if present, trust it as a stated intent)
- Surrounding layout (grid columns, flex, container max width)

If the slot is genuinely unclear, record `slot_max_css_px: unknown` and flag it in the report — do not invent a number.

The slot drives the budget, not the source dimensions — if you find yourself sizing from the file, restart this phase from the JSX.

Surface classification picks the budget. See [`references/budgets-and-formats.md`](references/budgets-and-formats.md) — **load this file in Phase 4, not earlier.** Do NOT load it during Phases 1–3; the routing/measurement phases don't need it.

---

## Phase 5 — Per-image audit

**Exit condition:** every image has a list of zero or more findings, each with a concrete fix.

For each image:

1. **Oversize** — is `width_px` more than ~2× the `slot_max_css_px`? Resize first, before any format change.
2. **Wrong format** — PNG/JPG screenshot or photo with no transparency? → WebP (or AVIF for photos). PNG with transparency that's actually a logo? → SVG. See the format matrix in references.
3. **Over budget** — does `bytes` exceed the surface budget after the resize would land?
4. **Missing dimensions** — no `width`/`height` attributes → CLS risk.
5. **Missing `sizes`** on responsive images larger than a card.
6. **`priority` discipline** — exactly one above-the-fold LCP candidate per page should have it; flag if zero or many.
7. **Missing `loading="lazy"`** on below-the-fold images that aren't the LCP candidate.

Skip rules — record but don't flag:

- SVG icons under ~10 KB
- Files already at-or-under budget AND within 2× of slot AND in a modern format

---

## Phase 6 — Report

**Exit condition:** a single markdown table delivered to the user, plus a ranked fix list.

Table columns: `File · Format · Dims · Bytes · Slot · Surface · Findings · Fix`. One row per image. Keep `Fix` as a single concrete instruction (`Resize to 1280px wide WebP, target ≤180 KB`), not a paragraph.

Below the table, list the top 3–5 fixes ranked by estimated bytes saved. Estimate is rough — `current_bytes - target_budget` for oversize cases, `current_bytes × 0.4` for raw PNG→WebP swaps at appropriate dimensions. Mark estimates as estimates.

Then ask: `Apply (a)ll, (s)elect specific fixes, or (r)eport only?`

---

## Phase 7 — Apply (only on user request)

**Exit condition:** the requested fixes are applied; nothing else changed.

- JSX edits (add `sizes`, `width`, `height`, `priority`, `loading="lazy"`, swap component) — apply via Edit.
- Binary file changes (resize, format conversion, compression) — **do not run a transform command without telling the user what tool you'll use and confirming.** Prefer `sharp` if it's already in `package.json`; otherwise tell the user to run TinyPNG / Squoosh / their existing pipeline and apply only the JSX changes for them.
- Never delete the original source file. Add the optimized derivative alongside it (or replace only after the user confirms).

---

## NEVER

- **NEVER recommend a format change without first checking pixel dimensions**
  **Instead:** Run Phase 3 measurements before Phase 5. If a 4000px PNG should become a 1280px WebP, the resize is the first-order win; the format swap is secondary.
  **Why:** "Convert to WebP" applied to an oversized source file ships a smaller-but-still-oversized file and hides the real problem from the next audit.

- **NEVER invent a slot width when the JSX is ambiguous**
  **Instead:** Record `slot_max_css_px: unknown` and flag the image as "needs slot inspection in browser DevTools." Ask the user if they want to measure in-browser.
  **Why:** A guessed slot produces a wrong budget, which produces a wrong recommendation. The user trusts the table; one fabricated number poisons it.

- **NEVER auto-run a binary transform (resize, format convert, compress) without the user's explicit go-ahead**
  **Instead:** Report the fix; wait for Phase 7 selection; then state the exact command before running.
  **Why:** Binary edits to committed assets are easy to mess up (wrong quality, lost transparency, overwritten source) and hard to diff-review afterwards.

- **NEVER fetch remote (`https://`) image URLs to measure them**
  **Instead:** Mark them `REMOTE` and surface in the report as "verify CDN transform pipeline."
  **Why:** Remote fetches are slow, may be rate-limited, may pull authenticated content the agent shouldn't see, and the byte size at the CDN edge isn't necessarily what production serves.

- **NEVER mark every image `priority` or recommend it broadly**
  **Instead:** Identify the single most likely LCP candidate (largest above-the-fold raster) and recommend `priority` only there.
  **Why:** Eager-loading multiple images defeats the browser's prioritization heuristics and often regresses LCP instead of improving it.

- **NEVER recommend a `<picture>` / `srcSet` rewrite without slot evidence**
  **Instead:** Only suggest multiple sources when Phase 4 produced distinct slot widths per breakpoint. Otherwise a single right-sized image with `sizes` is the smaller, simpler win.
  **Why:** Adding more `<source>` entries without per-breakpoint slot data ships extra bytes for no measurable benefit and clutters the diff.

- **NEVER skip Phase 6 and start fixing in Phase 5**
  **Instead:** Report fully first, then ask. The audit's value is the consolidated table; jumping to fixes throws that away.
  **Why:** The user often wants to see all findings together to pick which are worth the churn — partial fix-as-you-go forces them to re-audit later.
