---
name: debug-react
description: React-specific silent-failure patterns the generic fix-bug skill won't catch — closure side-effects inside `setState` updaters, stale `useCallback([])` closures, `useEffect` dep array bugs, StrictMode double-invocation surprises, and focus/DOM races during unmount. Use as a routed sub-skill from fix-bug when the bug is in a React app and the failure is in the state-management layer (visible state changes "partially correct" — one paired update lands but a sibling side effect doesn't fire). Run when the user says "/debug-react", routes to this skill explicitly, or when fix-bug's trace lands at a `useState`/`useReducer`/context store. Skip for crashes with a stack trace or pure render-output bugs — those have their own evidence.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options or confirm, use the `AskUserQuestion` tool — not numbered plain text.

# debug-react

React-specific silent failures hide in the state layer, not the I/O layer. The component re-renders, the screen updates, the user sees *something* change — but a sibling side effect that was supposed to run alongside the state update never fired. The bug looks "partially correct" and survives review because the visible behavior is plausible.

This skill is the routed extension of `agentsystem-core:fix-bug` for React apps. fix-bug owns the generic seam audit (HTTP, IPC, env injection, swallowed catches). debug-react owns the React state-machine seams.

---

## When to route here from fix-bug

- The trace lands inside a reducer, `useState` setter, `useReducer` dispatch, Zustand/Jotai/Redux store, or context provider.
- One of N paired side effects after a `setX(...)` call silently no-ops (state still updates; sibling state, IPC, or cleanup does not).
- A `useCallback(..., [])` or `useEffect(..., [])` callback reads a closure variable that's "always stale" but the user can't pinpoint why.
- StrictMode-only behavior: works in prod, breaks in dev (or vice versa).

---

## React-specific silent-failure patterns

Grep these on the suspected files. Each pattern is a known cause of "ran but downstream effect missing":

```bash
# Closure assignment inside setState updater, read after dispatch.
rg -nU '(?s)set[A-Z]\w*\(\s*\(\s*\w+\s*\)\s*=>\s*\{[^}]*?\b\w+\s*=' <files>

# useCallback / useMemo with empty deps that close over state.
rg -n 'use(Callback|Memo)\([^,]+,\s*\[\s*\]\s*\)' <files>

# useEffect with deps array that excludes a referenced state/prop.
rg -n 'useEffect\(' <files>   # then read the body vs deps manually

# Side effects inside render (not in an effect / event handler).
rg -n 'set[A-Z]\w*\(' <files> # check for calls outside handlers/effects
```

For each hit, ask: *"If this updater runs lazily, or if this closure captured stale state, which downstream branch silently no-ops?"*

---

## Known React state-layer bugs

### 1. Closure side-effects inside `setX((prev) => {...})`

Anti-pattern:

```ts
let ownerProjectId: string | null = null;
let neighborId: string | null = null;
setSessionsByProject((prev) => {
  // ... find owner, compute neighbor ...
  ownerProjectId = pid;
  neighborId = filtered[pick].id;
  return next;
});
if (ownerProjectId) {                    // ← always null on first read
  setFocusedByProject(prev => ...);      // ← never fires
}
electron.pty.kill(killedPtyId);          // ← never fires
```

**Why it fails silently:** React 18 useState updaters run lazily during reconciliation, not synchronously when dispatch is called. The closure variables are still `null` when the next line reads them. The `setSessionsByProject` update *does* eventually apply (during the next render), so the visible state changes — but every gated side effect after it is silently skipped.

**Fix:** Compute owner/neighbor/id values *before* dispatching. If the callback is wrapped in `useCallback(..., [])` and can't read state directly, mirror state into a `useRef` and read from `ref.current`:

```ts
const sessionsRef = useRef(sessionsByProject);
useEffect(() => { sessionsRef.current = sessionsByProject; }, [sessionsByProject]);

const killTerminal = useCallback(async (id) => {
  // synchronous lookup against the current snapshot
  const { ownerProjectId, neighborId, killedPtyId } = lookupOwner(sessionsRef.current, id);
  if (!ownerProjectId) return;
  setSessionsByProject(prev => /* pure update */);
  setFocusedByProject(prev => /* pure update */);
  if (killedPtyId) await electron.pty.kill(killedPtyId);
}, []);
```

### 2. Stale closure in `useCallback(..., [])` / `useEffect(..., [])`

A handler captures state at mount time and never re-reads it. Symptom: handler runs, but operates on initial values.

**Diagnostic:** Add `console.log` of the suspected stale value inside the handler. If it's always the initial value, deps are wrong. Either add the value to deps, or read it from a ref.

### 3. StrictMode double-invocation masking idempotency bugs

Effects, reducers, and component bodies run twice in dev StrictMode. Non-idempotent code (incrementing counters in render, registering listeners without cleanup, kicking off requests in render) silently double-runs in dev.

**Diagnostic:** If a bug only repros in dev, suspect StrictMode. Wrap the suspect code in a single-fire ref guard or move it to an event handler.

### 4. Focus / DOM race during sibling unmount

When a focused element's component unmounts in the same commit that flips a sibling's `focused` prop true, the unmounting child's `dispose()` / cleanup can rip `document.activeElement` back to `<body>` after the sibling's synchronous `el.focus()` call.

**Fix:** Defer the focus call to the next animation frame so the unmounting cleanup settles first:

```ts
useEffect(() => {
  if (!focused) return;
  const raf = requestAnimationFrame(() => ref.current?.focus());
  return () => cancelAnimationFrame(raf);
}, [focused]);
```

(But verify the state-layer first — the focus race only matters if the focused state actually moved. In the bug that seeded this skill, the rAF guard fixed nothing because the state never moved at all; the real bug was #1.)

---

## NEVER

- **NEVER mutate outer-scope variables inside a `setX((prev) => {...})` updater and read them on the next line.**
  **Instead:** Compute the values synchronously *before* dispatching — read from a `useRef` mirror of the state if the callback has empty `useCallback` deps. Then call `setX(...)` and any sibling effects with values already in scope.
  **Why:** React 18 useState updaters run lazily during reconciliation, not on dispatch. Closure variables are still null on the next line, so any branch gated on them silently no-ops while the state update itself eventually applies — making the bug look "partially correct" and hiding the missing side effects.

- **NEVER assume a `useCallback(..., [])` callback sees current state.**
  **Instead:** Either include the state in deps (and accept the recreation), or mirror the state into a `useRef` and read from `ref.current`. Don't reach for the state variable directly.
  **Why:** Empty-deps callbacks freeze the closure at mount. The variable name resolves to the initial value forever, regardless of subsequent renders. Reads return stale data with no error.

- **NEVER theorize about React commit ordering / unmount races before verifying the state-layer dispatch path.**
  **Instead:** First confirm the state actually changed end-to-end (selector reads the new value, downstream gated branches actually ran). Only then investigate render-phase race theories.
  **Why:** State-layer bugs (lazy updaters, stale closures) and render-phase races produce overlapping symptoms — focus didn't move, value didn't update. The state-layer bug is far more common and far cheaper to verify; checking it first avoids hours spent on a render-phase theory for a state-flow bug.

---

## Post-step

Hand back to `agentsystem-core:fix-bug` for the standard fix narration (Step 7) and `agentsystem-core:code-simplify` post-step. This skill diagnoses; fix-bug owns the close-out.
