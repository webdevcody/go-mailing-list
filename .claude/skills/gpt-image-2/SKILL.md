---
name: gpt-image-2
description: Generate an image from a text prompt using OpenAI's gpt-image-2 API and save it into the project. Use when the user asks to "generate an image", "make a hero image", "create an og image", "generate a logo/illustration/screenshot placeholder", "I need an image of X", or "/gpt-image-2 <prompt>". After the image is on disk, follow whatever the user asked you to do with it next (wire it into a component, set as og:image, drop into public/, etc.), THEN hand off to `optimize-page-images` against the surface it was wired into so the raw PNG gets resized/reformatted before shipping. Skip for: editing existing images (this skill only generates), audits of existing images (use optimize-page-images), or when no API key is available and the user does not want to paste one.
---

# Generate image with gpt-image-2

Front door for "I need an image" requests in this codebase. The skill shells out to a small bash script that calls OpenAI's image-generation endpoint and writes the resulting PNG into the project, then hands control back to you to wire the image up however the user asked.

## Preconditions

The script reads the API key from `.openai-key` at the **project root** (the current working directory).

If `.openai-key` does not exist or is empty, stop and tell the user verbatim:

> I need an OpenAI API key to call gpt-image-2. Paste your key into a file named `.openai-key` at the root of your project (same directory as `package.json`), then re-run. The file is git-ignored on most setups, but double-check `.gitignore` before committing.

Do not prompt them for the key inline — the script only reads from disk.

## Inputs to gather before running

Ask only for whichever is missing:

1. **Prompt** — the description of the image. Be specific (subject, style, mood, color palette, aspect).
2. **Output path** — where the file should land (e.g. `public/og-image.png`, `src/assets/hero.png`). If the user already implied a destination ("set this as the og image", "use it as the hero on the landing page"), infer the path from the project's existing convention by listing the relevant folder first.
3. **Size** — optional, defaults to `1024x1024`. Common: `1024x1024`, `1024x1792` (portrait), `1792x1024` (landscape).

## Run

From the project root:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/gpt-image-2/generate.sh" "<prompt>" <output-path> [size]
```

The script:
- Verifies `.openai-key` exists and is non-empty (exits with a clear message otherwise).
- POSTs to `https://api.openai.com/v1/images/generations` with `model: "gpt-image-2"`.
- Decodes `b64_json` (or downloads `url` as a fallback) and writes the PNG to the output path, creating parent dirs as needed.

## After the image is written

Continue with whatever the user originally asked — this skill only handles generation. Typical follow-ups:

- **og:image / social share** → update the route's `head()` (TanStack Start) or `metadata` (Next.js) to point at the new file.
- **Hero / illustration in a component** → import or reference the asset from the component that needs it.
- **Placeholder asset** → just confirm the path and let the user wire it.

If the user did not specify a follow-up, report the output path and ask what to do next. Do not invent integrations.

## Mandatory post-step: optimize-page-images

If the image was wired into a UI surface (route, component, og:image, hero, anywhere it will be served to users), invoke the `optimize-page-images` skill against that surface before reporting done. gpt-image-2 returns a raw PNG at the requested dimensions — it is almost always larger than the rendered slot needs and in the wrong format (PNG when WebP/AVIF would be 5–10× smaller). Skipping this step ships bloat.

Skip the post-step only when:
- The image was saved to disk but not referenced from any UI file (pure placeholder the user will wire later — say so explicitly).
- The user explicitly said "don't optimize" / "leave it raw".

## Failure modes

- `exit 3` → `.openai-key` missing or empty. Show the verbatim message above.
- `exit 4` → OpenAI returned an API error (invalid key, billing, content policy, model name). Surface the error JSON to the user; do not retry silently.
- `jq` not installed → tell the user to `brew install jq` (mac) or the equivalent for their OS; the script depends on it for safe JSON encoding.
