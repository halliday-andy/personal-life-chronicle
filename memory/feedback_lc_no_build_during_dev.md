---
name: Feedback: never run `npm run build` while `next dev` is live
description: Production build and the dev server share the .next directory; building while dev runs clobbers the dev server's webpack chunks and 500s every route. Verify with tsc/eslint instead; only full-build when dev is stopped.
type: feedback
---

Established 2026-06-17 after this exact mistake took down `localhost:3001/globe` (and every route) with a 500.

**Do not run `npm run build` (next build) while the `next dev` server is running on this project.** They share the `.next/` directory, and the production build overwrites the dev server's webpack chunks. The running dev server then can't find them and 500s every route: `Error: Cannot find module './948.js'`, missing `.next/BUILD_ID` and `.next/fallback-build-manifest.json`.

**Why:** dev and prod emit incompatible artifacts into the same `.next/`. A build mid-dev-session corrupts the live server's expectations; it does not self-heal until `.next` is regenerated.

**How to apply:**
- Verify code changes with `npx tsc --noEmit` and `npx eslint <files>` — these don't touch `.next` and are enough for almost everything.
- Run a full `npm run build` **only when the dev server is stopped** (or accept that you must then restart dev).
- **Recovery if it happens:** `kill` the next-dev pid (the node process LISTENing on :3001), `rm -rf .next`, then restart dev — `scripts/dev-up.sh` or `( nohup npm run dev > /tmp/lc-next-dev.log 2>&1 < /dev/null & )`. The dev log lives at `/tmp/lc-next-dev.log` (inngest at `/tmp/lc-inngest-dev.log`). A 307 from an unauthenticated `curl /globe` is healthy (auth redirect); a 500 is not.

Related: [[reference_lc_migration_apply]] for the other "use the running stack" workflows.
