# UX Rules Catalog

Opinionated rules to apply during Phase 4. Each rule cites the failure it prevents.

---

## Buttons & actions

### Never disable; always explain

A button that *could* be clicked must remain clickable. If the action is currently invalid, on click show the project's existing alert/toast/inline-error pattern explaining:

1. **Why** it can't be done right now (specific reason, not "invalid state")
2. **What** the user needs to do to unblock it
3. **Where** to go if step 2 is non-obvious (link if applicable)

**Failure prevented:** Disabled buttons leave users guessing whether the UI is broken, loading, or permission-gated. The hover tooltip workaround is invisible on touch devices.

### One primary CTA per viewport

At most one button styled as primary visible at a time. Secondary actions get secondary styling. Tertiary actions become text links or live in a menu.

**Failure prevented:** Multiple primaries = no primary. The user's eye has nowhere to land.

### Destructive actions need a guard, not a disable

Use a confirm step (modal, second-click "are you sure", typed confirmation for high-stakes). Never solve "user might click by accident" with disabling.

---

## Loaders

Pick based on **what's loading** and **how long it takes** — and match the project's existing pattern from Phase 1.

| Situation | Pattern |
|-----------|---------|
| Content with known shape (list, card grid, profile) | Skeleton matching the final layout |
| Action feedback (button click, form submit) | Inline spinner inside the button + disable form (this is the *one* place disable is okay) |
| Full page navigation | Route-level loading state, skeleton if shape known |
| Background refresh of already-visible data | Subtle indicator (top bar, dot), do NOT replace data with loader |
| Sub-200ms operations | No loader — flicker is worse than wait |

**If the project doesn't already have a skeleton component:** propose using `<Suspense>` + a simple skeleton built from the design system's primitives. Flag it as a small new pattern, not a dependency.

---

## Information architecture

### Split when the page serves two goals

If Phase 2 revealed two distinct user goals (e.g., "view my data" and "configure my account"), split into two routes. Keep the URLs predictable (`/data`, `/settings`) and link between them.

### Progressive disclosure for rarely-needed detail

Default view shows the 80% case. Use accordions, "Show advanced", or a separate `…/details` route for the 20%. Never solve density by shrinking fonts.

### Colocation over global

Component files belong next to the route that uses them, unless used by ≥2 routes. A `components/` folder full of single-use components is a sign of premature globalization. When proposing moves, cite actual file paths from Phase 1.

---

## Hierarchy

### Three weights, not seven

Pick three visual weights for content: primary (largest, boldest), secondary, tertiary. If you find yourself wanting a fourth, you're probably hiding a missing layer of organization.

### The eye should land on the primary action within 2 seconds

If a new visitor can't find the main CTA in two seconds, the hierarchy is broken. Common fixes: increase whitespace around it, reduce competing styled elements, move it above the fold.

---

## Forms

- Labels above inputs (not placeholder-only — placeholders disappear and fail accessibility).
- Validate on blur, not on every keystroke. Validate the whole form on submit.
- Errors live next to the field, in red, with specific guidance ("must be 8+ chars" not "invalid").
- Submit button stays enabled. On click with invalid form, scroll to and focus the first error.

---

## Decision criteria for Phase 4

Pick the redesign decision based on diagnosis:

| Diagnosis (Phase 3) | Likely decision |
|--------------------|-----------------|
| Priority conflict | `redesign-in-place` (re-rank with the three-weights rule) |
| Mixed concerns | `split-into-pages` (cite the new route paths) |
| Hidden primary action | `redesign-in-place` (move above fold, reduce neighbors) |
| Weak hierarchy | `redesign-in-place` (apply three-weights) |
| Premature density | `progressive-disclosure` (default 80% view, opt into detail) |

If two diagnoses apply, pick the more structural one (split > rearrange).
