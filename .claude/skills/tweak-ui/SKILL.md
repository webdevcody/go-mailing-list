---
name: tweak-ui
description: Elicit the three slots a small UI tweak needs — location, current behavior, desired behavior — when the user's request is missing one or more, then make the smallest possible change. Use for visual/copy/styling tweaks to a single element or component. Trigger phrases: "tweak this", "make X bigger/smaller/greener", "change the color/padding/spacing", "this looks off", "move this", "rename this label", "fix the alignment", "the button should...". Skip for: new features (use add-feature); bug investigations where a behavior is broken (use fix-bug); enum/state renames (use code-realign); changes spanning multiple components or files (use modify-feature or add-feature).
---

# Clarify UI Tweak

A small UI tweak fails when any of three slots is missing:

1. **Location** — which screen, route, component, file, or visual element
2. **Current** — what it looks like or does today
3. **Desired** — what should change

Without all three, the agent edits the wrong element, "fixes" something that wasn't broken, or ships a change that doesn't visibly appear.

## Before editing

Ask yourself two questions, in order:

1. **Is this actually a tweak?** A tweak changes how an existing element looks or reads. If the request needs new state, new data, new components, or behavior across multiple files, it's a feature — say so and offer to switch to add-feature. Don't try to squeeze it through this skill.
2. **Do I have location, current, and desired — explicitly or unambiguously from prior conversation/screenshot?**

If a slot is missing, ask in one short message. Ask only for what's missing. Batch multiple missing slots into a single question — don't ping-pong.

Slot-prompt templates:
- Missing location → "Which component/file or route? A path or screenshot works. If you don't know either, paste the visible label/heading nearest the element and a few words of surrounding text — I'll grep."
- Missing current → "What does it look like / do right now?"
- Missing desired → "What should it do/look like instead?"

A screenshot or a path counts as location. A description of the target alone does not imply current state.

## Scope discipline

Once the three slots are filled:

- Edit the smallest set of lines that satisfies the desired state
- Don't refactor adjacent code, extract helpers, or rename neighbors
- Don't add or update tests for a visual tweak unless asked
- Don't start a dev server unless the change is hard to eyeball from the diff
- If you notice adjacent issues, mention them in one line — don't fix them

## NEVER

- **NEVER guess the location when the user didn't name a file, component, or clearly visible element**
  **Instead:** Ask once. A path, route, or screenshot resolves it in seconds.
  **Why:** Editing the wrong component produces a "fix" that doesn't appear, and the user re-runs the request thinking the model is broken.

- **NEVER infer current behavior from the desired behavior**
  **Instead:** If the user only described the target state, ask what it does now.
  **Why:** "Make the button green" assumes it isn't green. If it already is, the real tweak is somewhere else (hover, disabled, dark mode) and you'll edit the wrong rule.

- **NEVER proceed with two or more missing slots by inferring them**
  **Instead:** Batch all missing slots into one question before editing.
  **Why:** Each inferred slot multiplies the chance of a wrong edit; one batched question is cheaper than a bad diff plus a redo.

- **NEVER expand scope past the literal tweak**
  **Instead:** Stop after the change. Surface adjacent issues as a one-line note, don't fix them.
  **Why:** The user invoked a tweak path, not a refactor. Bundled extras make the diff hard to review and turn a 30-second task into a 10-minute one.

- **NEVER hand off to add-feature, fix-bug, code-realign, modify-feature, or code-check-duplication for a tweak**
  **Instead:** Stay in this skill. If the request grows mid-conversation (new behavior, new data shape, new states across files), say so and offer to switch.
  **Why:** Heavy skills add discovery/planning/review phases that are pure overhead for "make this padding 8px" and burn the user's time and context budget.

- **NEVER skip the slot check because the request "sounds simple"**
  **Instead:** Run the three-slot check on every tweak request, even one-liners.
  **Why:** "Move the button" sounds trivial but is unanswerable without location and direction; the simplicity of the phrasing is what hides the missing slots.
