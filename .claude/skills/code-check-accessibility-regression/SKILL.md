---
name: code-check-accessibility-regression
user-invocable: false
metadata:
  audience: handoff
description: Internal handoff target invoked by add-feature, modify-feature, and tweak-ui after UI mutation. Scoped, changed-files-only accessibility audit — a faster sibling to `audit-a11y` that runs automatically without producing whole-app noise. Catches icon buttons missing accessible names, dialogs missing focus trap or initial focus, custom clickable `<div>`s where a `<button>` belongs, form errors not associated with their fields (`aria-describedby` missing), broken keyboard paths (no `:focus-visible` on a custom interactive element). Reports findings ranked by severity; auto-fixes only mechanical issues (`aria-label` on icon button, `htmlFor` on label, `<div onClick>` → `<button>` when no other interactive nesting). Trigger phrases for routing: "a11y check", "accessibility regression", "did this break a11y", "audit a11y in changes". Skip for backend-only changes, doc/comment-only changes, test-fixture-only edits.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# Code Check Accessibility Regression

A targeted, changed-files-only accessibility sweep. Sibling to the broader `audit-a11y` skill; this one runs as a post-step, fixes mechanical gaps inline, and reports the rest. The whole-repo audit is `audit-a11y`'s job.

---

## When to run

Run when **any** is true:
- A new component, page, or route added or changed JSX.
- A new interactive primitive (button, link, input, dialog, menu) appeared in the diff.
- A form was added or its labeling changed.
- The user says: "a11y check", "did this break a11y", "audit a11y in changes".

**Do NOT run** for: backend-only changes, doc/comment-only changes, test-fixture-only edits.

---

## Workflow

### Step 1 — Determine scope

```bash
git diff --name-only HEAD 2>/dev/null
git diff --cached --name-only 2>/dev/null
```

Filter to `*.tsx`, `*.jsx`. Skip `*.test.*`, `*.stories.*`, `*.d.ts`.

### Step 2 — Run six detectors

#### Detector A — Icon-only button without accessible name (**HIGH**, **auto-fixable** in clear cases)

```bash
# Buttons whose only child is an icon component (lucide, heroicons, etc.)
rg -n --type tsx -E '<button[^>]*>\s*<(\w+Icon|\w+)\s*/>' <scope>
rg -n --type tsx -E '<Button[^>]*>\s*<(\w+Icon|\w+)\s*/>' <scope>
```

For each hit: check whether the element has `aria-label`, `aria-labelledby`, or visible text. If none: **HIGH**. **Auto-fix** when the icon's component name suggests a label (`<TrashIcon />` → `aria-label="Delete"`, `<XIcon />` inside a Dialog close button → `aria-label="Close"`). Otherwise report only.

#### Detector B — Custom clickable `<div>` / `<span>` (**HIGH**, **auto-fixable** in narrow cases)

```bash
rg -n --type tsx -E '<(div|span)[^>]*\bonClick' <scope>
```

For each hit: a `<div onClick>` is keyboard-inaccessible by default. **Auto-fix** by replacing with `<button type="button">` ONLY when:
- No nested interactive elements (which would make a button-in-button).
- No layout-critical CSS that depends on `<div>` defaults (block display is fine; flex child positioning may break).

If either condition fails: report only with the suggestion to convert OR add `role="button" tabIndex={0} onKeyDown` (handle Enter/Space).

#### Detector C — `<label>` not associated with input (**MEDIUM**, **auto-fixable**)

```bash
rg -n --type tsx -E '<label[^>]*>' <scope>
```

For each label: check for `htmlFor=` matching an input's `id`, OR the input nested inside the label. If neither: **MEDIUM**. **Auto-fix** when there's exactly one `<input>`/`<textarea>`/`<select>` nearby AND it has an `id`: add `htmlFor={id}`. Otherwise report.

#### Detector D — Form error not associated with field (**MEDIUM** severity)

```bash
rg -n --type tsx -F 'errors.' <scope>
rg -n --type tsx -F 'formState.errors' <scope>
```

For each rendered error message: check whether the corresponding input has `aria-describedby` pointing at the error's `id` AND the input has `aria-invalid={true}` when invalid. If missing: **MEDIUM**. Don't auto-fix — wiring requires reading the form-library API and naming convention.

#### Detector E — Dialog without focus trap or initial focus (**HIGH** severity)

```bash
rg -n --type tsx -E '<(Dialog|Modal|Sheet|Drawer)\b' <scope>
```

For each custom (non-Radix/non-shadcn) dialog: check that the file imports a focus-trap utility (`focus-trap-react`, `react-focus-lock`, or has `<FocusScope>`/Radix primitives). If using vanilla portal + manual implementation with no trap: **HIGH**. Don't auto-fix — recommend switching to the project's existing dialog primitive (locate by grep).

If the dialog uses Radix `<DialogPrimitive>` or shadcn `<Dialog>`, focus is handled — pass.

#### Detector F — Image / decorative element missing `alt` (**MEDIUM**, **auto-fixable** in narrow cases)

```bash
rg -n --type tsx -E '<img\b' <scope>
```

For each `<img>`: check for `alt=`. If missing: **MEDIUM**. **Auto-fix** to `alt=""` ONLY when the image is decorative-by-context (sibling already labels the surface, OR the file/variable name contains `decorative|background|bg`). Otherwise report — alt text is a content decision.

### Step 3 — Report

```
## A11y regression scan — <N> findings (<auto-fixed> auto-fixed)

### HIGH — <count>
1. **Icon button missing accessible name** — `<file>:<line>`
   - `<button><TrashIcon /></button>`
   - Auto-fixed: <yes — added `aria-label="Delete"` | no — icon name ambiguous>.

2. **Custom dialog without focus trap** — `<file>:<line>`
   - Suggest: replace with the project's `<Dialog>` primitive at `<dialog-file>:<line>` (handles focus trap, escape, restore).

### MEDIUM — <count>
3. **Label not associated with input** — `<file>:<line>`
   - Auto-fixed.

4. **Form error not announced to screen readers** — `<file>:<line>`
   - Input lacks `aria-describedby={errorId}` and `aria-invalid`.
   - Suggest: add both based on the form's validation state.

5. **`<img>` missing `alt`** — `<file>:<line>`
   - Suggest: `alt="..."` (content decision) or `alt=""` if decorative.

---

No a11y regressions detected.    ← only if 0 findings
```

---

## NEVER

- **NEVER auto-pick alt text from filename or src URL**
  **Instead:** Auto-fix to `alt=""` only when context strongly indicates decorative; otherwise report. Alt text is content; the user owns it.
  **Why:** Guessed alt text gets shipped, indexed by screen readers, and embarrasses the product. "marketing-hero-final-v3.jpg" → `alt="marketing hero final v3"` is worse than missing.

- **NEVER auto-convert `<div onClick>` to `<button>` if it has nested interactive children**
  **Instead:** Report it. A button-in-button is invalid HTML and produces unpredictable focus/click behavior.
  **Why:** The auto-fix introduces a new bug (invalid nesting) while claiming to fix the original — strictly worse than the original gap.

- **NEVER flag Radix / shadcn / Headless UI primitives as a11y issues**
  **Instead:** Detect the primitive's import path and skip; these libraries handle a11y by design.
  **Why:** False positives on the correct pattern train the user to ignore the report; the whole point of using these primitives is that they're already correct.

- **NEVER scan the whole repo when a diff exists**
  **Instead:** Default to `git diff --name-only HEAD` ∪ uncommitted. Whole-repo a11y belongs to `audit-a11y`.
  **Why:** Two skills covering the same surface produces double findings; this skill exists specifically to be a low-noise post-step.

- **NEVER attempt color-contrast checks here**
  **Instead:** Defer to `audit-a11y` — contrast requires design-token knowledge and computed-style resolution.
  **Why:** A grep can't compute contrast ratios; reporting "might fail contrast" is noise.
