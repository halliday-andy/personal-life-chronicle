---
name: feedback_lc_origin_backup_autopush
description: origin/main must stay current as a continuous backup; auto-push hook now does this after every commit. The global "don't push" rule is carved out for backups in this project.
metadata:
  type: feedback
---

Andy's standing intent: `origin/main` is a **continuous backup** and should
track local `main` closely. In this project, the global commit-autonomy rule
("do NOT push to remote unless explicitly asked") is **carved out for backup
pushes** — pushing committed work to origin is expected, not a deviation.

**Why:** On 2026-06-18, `origin/main` was found **122 commits / 13 days
behind** (last push 2026-06-04, `49c3541`). Root cause: the backup objective
was encoded *nowhere operative* — not in a git hook, not in Claude settings,
not in CLAUDE.md (which said the opposite: don't push), and not in the
permission allowlist (`git push` wasn't even allowed). Every session committed
autonomously but never pushed, so commits piled up locally and origin froze.
It went unnoticed because no session was told backup was a goal; the handoff
note even normalized it ("all shipped to main, not pushed").

**How to apply:** You normally do nothing — a `PostToolUse` hook in
`.claude/settings.json` (matcher `Bash`, `if: Bash(git commit *)`) runs
`git push origin HEAD` after every commit, `async: true` + `|| true` so it
never blocks the turn or fails the session when offline. Backup cadence tracks
commit cadence automatically. Allowlist now includes `Bash(git push *)`.
Caveats: (1) the hook only auto-pushes *commits made by a tool call* — if a
push fails offline, push manually before the session ends; (2) it pushes the
current branch (`HEAD`), so on a feature branch it backs that branch up, which
is fine. Verified live this session: committing the hook itself auto-advanced
`origin/main` to `95160e3` with no manual push.

Lesson for the class of bug: **an intention that lives only in someone's head
is not a mechanism.** "I'll remember to push" is exactly what failed for 13
days. Durable objectives must be encoded where the harness enforces them (a
hook), not just where a human or agent might recall them. See
[[feedback_lc_memory_dual_write]] (same failure mode — a mirror silently
drifting because nothing automated kept it in sync).
