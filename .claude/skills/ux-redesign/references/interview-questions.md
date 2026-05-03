# Interview Question Bank

Use in waves of 2-3. Don't dump the whole bank. Adapt phrasing to the user's domain.

---

## Goal (always ask first)

- In one sentence, what is this page *for*?
- If a user lands here and does nothing else, what one action would make the visit a success?
- What would have to be true for you to delete this page entirely? (Surfaces whether the page has a real job.)
- Is this a destination page (user came here on purpose) or a waypoint (passing through)?

## User

- Who visits this page — role, technical level, frequency?
- What page did they come from? What were they doing 30 seconds before landing here?
- Is this their first visit, hundredth, or somewhere between? (First-visit pages need orientation; hundredth-visit pages need speed.)
- What do they already know when they arrive? What context can you assume?

## Priority (force ranking)

- If you could only keep three elements on this page, which three?
- Of the remaining elements, which are "useful but could live elsewhere" vs. "actively in the way"?
- If a user only reads the top of the page, what must be there?
- Which element gets clicked most? Which gets clicked least? (If unknown, that's a finding — propose adding analytics or ask the user to estimate.)

## Cut (the question authors skip)

- What's on this page that no one ever uses?
- What's here because it was easy to add, not because users asked for it?
- Which sections are duplicating what another page already does?
- If you removed [secondary feature X], what would break for users? (If "nothing", cut it.)

## Confusion sources (when user said "feels confusing")

- Where do users hesitate? (If the user has session recordings or analytics, ask.)
- Have you gotten support questions about this page? What do they ask?
- Is there a step where users have to re-read to understand what to do?
- Are there two elements that look similar but do different things? Two that look different but do the same?

## Clutter sources (when user said "feels cluttered")

- Are multiple sections all styled as "primary"?
- Is the page trying to serve two different user goals? (Strong signal for `split-into-pages`.)
- How many distinct CTAs are visible without scrolling? (More than 2 is usually too many.)
- Is data that's rarely needed shown by default instead of behind a disclosure?

---

## Exit criteria

Do not leave Phase 2 until you can write each of these in one sentence:

1. **Primary job:** "This page exists so a [user] can [action]."
2. **Top three elements** (ranked).
3. **Cut list** — at least one item the user agreed to remove or move.
4. **Diagnosis hypothesis** — which Phase 3 shape (priority conflict, mixed concerns, hidden primary, weak hierarchy, premature density) you suspect.
