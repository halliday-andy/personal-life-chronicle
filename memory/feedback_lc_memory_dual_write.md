---
name: Life Chronicle — memory dual-write protocol
description: When saving any memory in the Personal-Life-Chronicle project, always write to both the Cowork auto-memory location and the git-tracked workspace mirror; one fails the protocol fails
type: feedback
---

When writing, editing, or removing any memory file (including `MEMORY.md`) for the Personal-Life-Chronicle project, write to BOTH of these locations:

1. **Auto-memory (Cowork-managed):** `~/Library/Application Support/Claude/local-agent-mode-sessions/<session>/<env>/spaces/<space>/memory/`
2. **Workspace mirror (this folder):** `/Users/andyhalliday/Desktop/_LOCAL-DEV.nosync/Personal-Life-Chronicle/memory/`

Both folders must end up holding identical content after every memory change. The workspace mirror is committed to git and is how Andy reviews the design record outside Cowork sessions.

**Why:** The auto-memory folder is loaded into every conversation context automatically, but it lives in an opaque OS Library path that is not version-controlled and not visible to Andy in normal file browsing. Andy explicitly wants the design record (gaps, decisions, refinements, MVP scope, access cards framing, shareable artifacts framing, etc.) under his project folder so it survives machine changes, lives alongside the schema and design docs, and can be reviewed in plain text. In an earlier session the mirror was created by Sonnet 4.6 but not maintained — by today (2026-04-27) the mirror was three memory files behind the auto-memory location, which Andy noticed and explicitly directed should not happen again.

**How to apply:**
- New memory file → Write at both paths.
- Edit to existing memory file → Apply same Edit at both paths.
- New `MEMORY.md` index entry → Add same line at both paths.
- Removal → Remove from both.

If a write to the workspace mirror fails (folder unmounted, permissions), surface the failure rather than silently proceeding with auto-memory only.

A README at `/Users/andyhalliday/Desktop/_LOCAL-DEV.nosync/Personal-Life-Chronicle/memory/README.md` documents this same protocol for any other agent or human who opens the workspace.
