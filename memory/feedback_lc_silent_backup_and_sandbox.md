---
name: feedback_lc_silent_backup_and_sandbox
description: Claude Code sessions here can run in a remote sandbox (not Andy's Mac) with a read-only GitHub token; and the auto-push backup hook silently swallowed failures. Both surfaced and fixed 2026-07-04.
metadata:
  type: feedback
---

Two related discoveries on 2026-07-04, both refinements of
[[feedback_lc_origin_backup_autopush]].

**1. Sessions may run in a remote sandbox, not on Andy's Mac.** Claude Code
launched from the desktop app can execute in a managed cloud container (Linux,
`/home/user/...`, running as `root`) against a *fresh clone* whose `origin` is
a local git relay — NOT Andy's local working copy, NOT a direct GitHub remote.
That environment's GitHub token is **read-only**: `git push` and GitHub App
writes return `403` / "Resource not accessible by integration". Reads work, and
`get_me` shows Andy, so it is not a wrong-account problem — the token simply
lacks `Contents: write`. Consequences: (a) the CLAUDE.md dual-write paths
(`/Users/andyhalliday/...`) don't exist there and cannot be honored; (b)
nothing committed inside a sandbox session can reach origin from within it
(deliver via `git format-patch` → Andy applies with `git am` + `git push`
locally). Tell-tale: `pwd` is `/home/user/...` and `git remote -v` shows a
`127.0.0.1:.../git/...` relay. Decision: keep this project on **local
execution**; grant the Claude GitHub App `Contents: write` only if remote
sessions are ever actually wanted (and reconcile the dual-write paths first).

**2. The auto-push backup hook failed silently.** The hook ran
`git push origin HEAD 2>/dev/null || true`. The `|| true` (non-blocking) is
fine, but the `2>/dev/null` **hid the error**, so a *permanent* failure (the
sandbox 403) looked identical to success — silently recreating the exact
"origin drifts and nobody notices" bug the hook was built to prevent. Fix
(on `main`, 2026-07-04): dropped `2>/dev/null` (kept `|| true`), and added a
**Stop hook** that checks `HEAD` actually reached its upstream and warns loudly
(`exit 2`) if the branch has no upstream or has un-pushed commits. The backup
guarantee now lives in an observable end-of-session check, not a
fire-and-forget push.

Lesson (same class as [[feedback_lc_memory_dual_write]] and the original
[[feedback_lc_origin_backup_autopush]]): a safety mechanism must **surface its
own failures**. Silent-on-failure is the one thing a backup or a mirror must
never be.
