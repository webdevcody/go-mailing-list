---
name: agentsystem-init
description: Initialize or refresh a project for the AgentSystem plugin system by writing a concise table-of-contents of available AgentSystem skills into the project's agent-instruction file (CLAUDE.md and/or AGENTS.md). The TOC lists each skill's invoke command and one-line "when to use" so future LLM sessions route to the right skill faster. Idempotent — re-run anytime to pick up new skills. Trigger phrases — "init agentsystem", "agentsystem init", "set up agentsystem in this project", "add agentsystem TOC", "refresh skill index", "/agentsystem-init", "list agentsystem skills in CLAUDE.md", "make this project agentsystem-aware". Skip for projects that aren't using the AgentSystem plugin system.
---

> **User-question protocol:** Whenever this skill needs the user to pick between options, confirm an action, or answer a multiple-choice prompt, you MUST call the `AskUserQuestion` tool to render a proper interactive picker. Do NOT print numbered options as plain text and wait for the user to type a number — that produces a degraded UX. Free-form questions (open-ended typing) may be asked in prose, but any time you would write "1) … 2) … 3) …", use `AskUserQuestion` instead.


# AgentSystem Init

Inject (or refresh) a router-style table-of-contents of AgentSystem skills into the project's agent-instruction file(s).

## Block template

Use this verbatim — substitute only the table rows. Do not paraphrase the markers, the heading, or the "Re-run" line:

```
<!-- agentsystem-toc:start -->
## AgentSystem Skills (auto-generated)

Re-run `/agentsystem-init` to refresh.

| Command | When to use |
|---------|-------------|
| `/skill-name` | one-line trigger blurb |
| ... | ... |
<!-- agentsystem-toc:end -->
```

## Procedure

### 0. Frame the run

Before touching either file, confirm:

- (a) The user actually uses AgentSystem in this project (was the skill invoked deliberately?).
- (b) No unmanaged AgentSystem TOC already exists outside the markers.
- (c) The upstream fetch in Step 2 succeeded.

If any answer is no, stop and surface the issue — do not write a partial or guessed block.

### 1. Detect target files

Check the project root (cwd) for these files, in order:

- `CLAUDE.md`
- `AGENTS.md`

Behavior:
- **Both exist** → update both with the same block.
- **One exists** → update that one only. Do not create the other.
- **Neither exists** → ask the user which to create (`CLAUDE.md`, `AGENTS.md`, or both). Do not assume.

### 2. Fetch the canonical skill list

WebFetch `https://raw.githubusercontent.com/AgentSystemLabs/core/main/README.md` with a prompt asking for: every skill name, its slash-command, and a one-line "when to use" trigger.

If the README does not enumerate skills (or is incomplete), fall back to listing the directories under `https://github.com/AgentSystemLabs/core/tree/main/plugins` via `gh api repos/AgentSystemLabs/core/contents/plugins`, then for each plugin enumerate its `skills/` directory and fetch each skill's `SKILL.md` frontmatter `description` to derive the one-liner.

Skill names are kebab-case directory names under `plugins/<plugin>/skills/<skill-name>/SKILL.md`. The slash-command is `/<skill-name>` (no plugin prefix). Plugins follow the `agentsystem-*` naming convention (e.g. `agentsystem-core`, `agentsystem-backend`, `agentsystem-frontend-ux`, `agentsystem-tanstack`, `agentsystem-electron`, `agentsystem-release-ops`, `agentsystem-spec-driven`, `agentsystem-quality-control`).

Always fetch fresh. Do not rely on locally-cached plugin directories — they may be stale or partial.

If **both** WebFetch and `gh api` fail (offline, rate-limited, repo unreachable), abort with: "Cannot reach AgentSystemLabs/core — retry when network is available." Do not write an empty or partial block.

### 3. Build the block

- One row per skill.
- "When to use" must be a single line. Truncate at ~120 chars; end with `…` if cut.
- Sort rows alphabetically by command for stable diffs.
- Wrap with the exact markers shown above. The `## AgentSystem Skills (auto-generated)` heading and "Re-run" hint must be inside the markers.

### 4. Write the block (idempotent)

For each target file:

- If `<!-- agentsystem-toc:start -->` and `<!-- agentsystem-toc:end -->` markers are both present → replace everything between them (inclusive) with the new block.
- If markers are absent → append a blank line then the new block to the end of the file.
- If only one marker is present → abort and report the file as malformed; ask the user to fix it before re-running.

### 5. Report

Print: each file touched, whether it was created/updated/inserted, and the count of skills listed. Nothing else.

## NEVER

- **NEVER create both `CLAUDE.md` and `AGENTS.md` when neither exists**
  **Instead:** Ask the user which file the project uses.
  **Why:** Many projects deliberately use only one; creating the other pollutes the repo and forks the source of truth.

- **NEVER write the TOC outside the marker block**
  **Instead:** Always wrap with `<!-- agentsystem-toc:start -->` / `<!-- agentsystem-toc:end -->`.
  **Why:** Re-runs rely on the markers to replace cleanly. Unmarked TOCs accumulate as duplicates.

- **NEVER expand a row to multiple lines or add a description column**
  **Instead:** Two columns only — command, one-line when-to-use.
  **Why:** This block is a router hint, not documentation. Bloat defeats the token-efficiency goal that justifies the skill's existence.

- **NEVER read skills from local plugin caches (`~/.claude/plugins/...`) as the source of truth**
  **Instead:** WebFetch from `AgentSystemLabs/core` on every run.
  **Why:** Local caches lag the upstream registry; a stale TOC will route agents to commands that don't exist or miss new ones.

- **NEVER edit content outside the marker block**
  **Instead:** Touch only the marked region (or the append point at EOF).
  **Why:** The user owns the rest of `CLAUDE.md` / `AGENTS.md`. This skill is a surgical injector, not an editor.

- **NEVER append a new block when an unmanaged AgentSystem TOC already exists**
  **Instead:** If a heading like `## AgentSystem Skills` (or any obvious hand-written skill index) is present *outside* the markers, abort and ask the user whether to convert the existing section into a managed block or leave it alone.
  **Why:** Silently appending creates two TOCs in the same file — the older, unmanaged one goes stale and routes agents to commands that may have been removed.
