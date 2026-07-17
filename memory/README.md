# Memory Folder

This folder is the git-tracked, human-visible mirror of the Cowork auto-memory location for the Personal-Life-Chronicle project. It lets the design history and decision record live alongside the schema, design docs, and PRD drafts, and survive outside a Cowork session.

**The operative rule — write every memory change to both this folder and auto-memory — lives in `../CLAUDE.md` ("Critical Protocol: Dual-Write for Memory Files"). Follow that copy; it is the one Claude actually loads each session.**

For why this protocol exists (the April 2026 drift incident it was built to prevent), see `feedback_lc_memory_dual_write.md`.

## Verification

After a memory change, you can verify dual-write by:
- Listing both folders and confirming file counts match.
- Diffing the two `MEMORY.md` files (they should be byte-identical).
- Running `git status` in the project root — the workspace mirror should show the change.
