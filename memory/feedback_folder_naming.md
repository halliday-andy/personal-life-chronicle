---
name: Feedback: Use lowercase for folder and file names
description: Always use lowercase (with hyphens, not spaces or capitals) when creating folders and files to avoid tooling incompatibilities
type: feedback
---

Use all-lowercase, hyphen-separated names when creating any folder or file in this project.

**Why:** `create-next-app` and many other Node/Unix tools reject directory names containing capital letters. When Claude Cowork created the `Personal-Life-Chronicle` folder with capitals, Claude Code had to scaffold the Next.js project in `/tmp` and manually copy files over — avoidable overhead.

**How to apply:** Any time you suggest creating a new folder or file — whether in a prompt, a script, or directly via file tools — use lowercase and hyphens only. For example: `life-chronicle-app`, `dev-notes`, `feature-share`. Never `Personal-Life-Chronicle`, `DevNotes`, or `FeatureShare`. This applies to directory names suggested in Claude Code prompts, file names in scaffolding instructions, and any new workspace folders created via Cowork.
