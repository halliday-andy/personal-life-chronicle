# Memory Folder — Dual-Write Protocol

**Purpose:** This folder is a git-tracked, human-visible mirror of the Cowork auto-memory location for the Personal-Life-Chronicle project. It lets the design history and decision record live alongside the schema, design docs, and PRD drafts.

## Two locations exist

1. **Auto-memory (Cowork-managed, primary):**
   `~/Library/Application Support/Claude/local-agent-mode-sessions/<session>/<env>/spaces/<space>/memory/`
   This is the location Cowork automatically loads as `MEMORY.md` into every conversation context. The auto-memory tooling writes here by default.

2. **Workspace mirror (this folder, for git and visibility):**
   `/Users/andyhalliday/Desktop/_LOCAL-DEV.nosync/Personal-Life-Chronicle/memory/`
   This folder is committed to git so the evolution of design thinking is recoverable and reviewable alongside the rest of the project artifacts.

The two folders should always hold identical content.

## Protocol for any agent (Claude or otherwise) working in this project

**When you save, update, or remove a memory, write to BOTH locations.**

Concretely:
- New memory file: write the same file at both paths above.
- Edit to an existing memory file: apply the same edit at both paths.
- New entry in `MEMORY.md` (the index): add the same line to both `MEMORY.md` files.
- Removal: remove from both.

Order is not significant; both must end up consistent before the conversation turn ends.

If a write to the workspace mirror fails (folder unmounted, permission error, etc.), prefer to surface the failure to the user rather than silently proceeding with auto-memory only — the mirror is what makes the record durable.

## Verification

After a memory change, the user can verify dual-write by:
- Listing both folders and confirming file counts match.
- Diffing the two `MEMORY.md` files (they should be byte-identical).
- Running `git status` in the project root — the workspace mirror should show the change.

## Why this protocol exists

Cowork's auto-memory is loaded automatically into conversation context but lives in an opaque OS Library path that is not version-controlled and not visible in normal file browsing. Without the workspace mirror, the design record would be inaccessible outside of Cowork sessions and would not survive a machine wipe, an account reset, or a switch between Claude products. The mirror gives the record its own life as a project artifact.

## Origin

Established April 2026 between Andy and Claude (Opus 4.7) after observing that the workspace mirror — created in an earlier session by Sonnet 4.6 — had drifted out of sync with the auto-memory location during a multi-session design conversation. The dual-write protocol prevents that drift going forward.
