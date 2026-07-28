# What shapes your AI before you type

*Your AI Setup Map*

> This report separates the **setup map** (controls the scanner could see) from the **run map** (controls proven to have shaped one job). Static presence is not proof of runtime use.

## Reported runtime

| Field | Value | Evidence |
|---|---|---|
| Surface | claude&#45;code | USER&#95;REPORTED |
| Model or router | USER&#95;REPORTED | USER&#95;REPORTED |

## Blind spots

| Area | Evidence | What remains unknown |
|---|---|---|
| hidden&#45;product&#45;controls | INACCESSIBLE | Hidden system instructions, product routing, account memory, and unexported settings were not visible. |
| runtime&#45;trace | INACCESSIBLE | No trace showed which controls were eligible, shown, consulted, acted through, checked, or accepted for a real job. |
| behavioral&#45;effect | NOT&#95;APPLICABLE | Static presence and text signals do not prove that a control helps or harms the work. |
| excluded&#45;paths | INACCESSIBLE | Some paths were deliberately excluded for privacy, safety, traversal, or relevance limits. Counts&#58; excluded&#45;directory&#58; 3, secret&#45;path&#58; 2. |
| semantic&#45;review&#45;gap&#45;001 | VERIFIED | Unused/stub Inngest agent functions and one build&#45;tool config file&#58; planner&#45;agent.ts, search&#45;agent.ts, timeline&#45;agent.ts, and all three synthesis&#45;agent.ts functions are verified stubs &#40;each just logs 'stub invoked' and returns a status string, per direct file read&#41; not yet wired to real logic; tailwind.config.ts is ordinary build tooling with no instructional content. Reviewing these individually would not change any recommendation, and the Quick Check bound &#40;50 reviewed controls&#41; was reached by the other 50 controls, which include every file with actual authority, routing, or standing&#45;context signal. Recommend a Maintainer Audit only if Andy wants these formally logged. |
| semantic&#45;review&#45;gap&#45;002 | INACCESSIBLE | Runtime activation and load order for every control&#58; This is a static file inventory. No run trace or product receipt was available, so for every file above 'KEEP' means 'this file's content is sound and its stated job is clear' — it does not mean 'this file was proven to load into a real Claude Code session.' CLAUDE.md's own auto&#45;load behavior is the one exception with reasonably strong inference &#40;Claude Code's documented project&#45;file convention&#41;, everything else's actual consultation is unverified. |
| semantic&#45;review&#45;gap&#45;003 | INACCESSIBLE | documentation/early&#45;planning&#45;v2/ sibling files&#58; Only cef&#45;schema.json from this folder appeared in the scanner's 55&#45;control inventory; four sibling files in the same folder &#40;README&#95;Import&#95;Validation.txt, Revised&#95;PRD&#95;v2.md, handoff&#45;checklist.md, lovable&#45;build&#45;spec.v2.md&#41; were not surfaced by the bundled scanner under Quick Check's default file&#45;type rules. Their freshness status is therefore unassessed. |
| semantic&#45;review&#45;gap&#45;004 | INACCESSIBLE | Hidden Claude Code product state&#58; Global &#40;non&#45;project&#41; skills, MCP server configuration, and any account&#45;level settings were out of scope for this project&#45;rooted scan, per the audit protocol's rule to map only the selected workspace root and its inherited configuration. |

## Setup map: what is visible or declared

Visible controls: **55**  
Inspected bytes: **320758**  
Controls without a cleanup decision: **5**

### Five stations in the setup

1. **Already there — 34 visible**  
   Standing instructions and remembered context visible before this job begins.  
   Examples: `CLAUDE.md`, `memory/decision&#95;phase0&#95;reframing&#95;2026&#45;05&#45;31.md`, `memory/decision&#95;step7&#95;image&#95;storage&#95;2026&#45;06&#45;04.md`
2. **How it chooses help — 4 visible**  
   Skills and routes that may make specialist help eligible.  
   Examples: `.claude/settings.json`, `.claude/settings.local.json`, `documentation/early&#45;planning&#45;v2/cef&#45;schema.json`
3. **What joins this job — 13 visible**  
   Prompts, references, and task context that may join a particular run.  
   Examples: `docs/plans/2026&#45;06&#45;22&#45;claude&#45;code&#45;handoff&#45;prompt.md`, `docs/plans/2026&#45;07&#45;04&#45;claude&#45;code&#45;handoff&#45;prompt.md`, `docs/plans/2026&#45;07&#45;07&#45;claude&#45;code&#45;handoff&#45;prompt&#45;post&#45;slice7.md`
4. **What it can do — 3 visible**  
   Tools, settings, permissions, and action boundaries.  
   Examples: `lib/agents/entity/tool.ts`, `lib/agents/tagger/tool.ts`, `memory/feedback&#95;lc&#95;silent&#95;backup&#95;and&#95;sandbox.md`
5. **What proves it is done — 1 visible**  
   Checks, validators, and evidence that can test the finish line.  
   Examples: `memory/decision&#95;step7&#95;prep&#95;checklist&#95;2026&#45;06&#45;04.md`

### Visible-control drill-down

| Target-relative control | Job | Owner | Load timing | Control type | Evidence | Decision |
|---|---|---|---|---|---|---|
| .claude/settings.json | Product or runtime configuration | UNKNOWN | UNKNOWN | SYSTEM&#95;CONFIGURATION | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| .claude/settings.local.json | Product or runtime configuration | UNKNOWN | UNKNOWN | SYSTEM&#95;CONFIGURATION | VERIFIED, INFERRED | Put it on probation &#40;PROBATION&#41; |
| CLAUDE.md | Standing project rules and context | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| docs/plans/2026&#45;06&#45;22&#45;claude&#45;code&#45;handoff&#45;prompt.md | Task or reusable prompt context | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Retire it safely &#40;RETIRE&#41; |
| docs/plans/2026&#45;07&#45;04&#45;claude&#45;code&#45;handoff&#45;prompt.md | Task or reusable prompt context | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Retire it safely &#40;RETIRE&#41; |
| docs/plans/2026&#45;07&#45;07&#45;claude&#45;code&#45;handoff&#45;prompt&#45;post&#45;slice7.md | Task or reusable prompt context | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Put it on probation &#40;PROBATION&#41; |
| docs/plans/2026&#45;07&#45;07&#45;claude&#45;code&#45;handoff&#45;prompt.md | Task or reusable prompt context | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Retire it safely &#40;RETIRE&#41; |
| documentation/early&#45;planning&#45;v2/cef&#45;schema.json | Product or runtime configuration | UNKNOWN | UNKNOWN | SYSTEM&#95;CONFIGURATION | VERIFIED, INFERRED | Put it on probation &#40;PROBATION&#41; |
| lib/agents/entity/tool.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| lib/agents/tagger/tool.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| lib/inngest/agents/capture&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| lib/inngest/agents/entity&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| lib/inngest/agents/globe&#45;extraction&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| lib/inngest/agents/planner&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Not decided |
| lib/inngest/agents/search&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Not decided |
| lib/inngest/agents/synthesis&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Not decided |
| lib/inngest/agents/tagger&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| lib/inngest/agents/timeline&#45;agent.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Not decided |
| memory/decision&#95;phase0&#95;reframing&#95;2026&#45;05&#45;31.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/decision&#95;step7&#95;image&#95;storage&#95;2026&#45;06&#45;04.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/decision&#95;step7&#95;prep&#95;checklist&#95;2026&#45;06&#45;04.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/decision&#95;step7&#95;slice&#95;phasing&#95;2026&#45;06&#45;05.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/feedback&#95;folder&#95;naming.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/feedback&#95;lc&#95;memory&#95;dual&#95;write.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/feedback&#95;lc&#95;no&#95;build&#95;during&#95;dev.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/feedback&#95;lc&#95;origin&#95;backup&#95;autopush.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/feedback&#95;lc&#95;silent&#95;backup&#95;and&#95;sandbox.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/MEMORY.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;access&#95;cards.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;architecture&#95;split.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;build&#95;progress.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Put it on probation &#40;PROBATION&#41; |
| memory/project&#95;lc&#95;capture&#95;assistant.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;db&#95;architecture.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;document&#95;sources.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;dual&#95;track&#95;final&#95;review.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;extraction&#95;reliability.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;future&#95;pin&#95;types.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;gap&#95;review&#95;april2026.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;globe&#95;entity&#95;ux&#95;brief.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;location&#95;design.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;ontology&#95;bootstrap.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;prd&#95;readiness.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;prd&#95;status.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;shareable&#95;artifacts.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;single&#95;post&#95;share.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;stroll&#95;feature.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/project&#95;lc&#95;temporal&#95;agent.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/README.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Give it one home &#40;ONE&#95;HOME&#41; |
| memory/reference&#95;lc&#95;designer&#95;skills.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/reference&#95;lc&#95;dev&#95;sequence.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/reference&#95;lc&#95;migration&#95;apply.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/reference&#95;lc&#95;schema&#95;files.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| memory/user&#95;andy&#95;profile.md | Saved context or preferences | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| supabase/config.toml | Product or runtime configuration | UNKNOWN | UNKNOWN | SYSTEM&#95;CONFIGURATION | VERIFIED, INFERRED | Keep it &#40;KEEP&#41; |
| tailwind.config.ts | Instruction or supporting reference | UNKNOWN | UNKNOWN | WRITTEN&#95;GUIDANCE | VERIFIED, INFERRED | Not decided |

## Run map: what actually shaped one job

Trace status: **NOT&#95;EXPOSED**

No run trace was supplied. The setup map must not be treated as proof that a control shaped a job.

| Funnel stage | Trace status | Observed count | Evidence detail |
|---|---|---:|---|
| Available | NOT&#95;EXPOSED | UNKNOWN | Requires a runtime trace or acceptance record. |
| Eligible | NOT&#95;EXPOSED | UNKNOWN | Requires a runtime trace or acceptance record. |
| Shown | NOT&#95;EXPOSED | UNKNOWN | Requires a runtime trace or acceptance record. |
| Consulted | NOT&#95;EXPOSED | UNKNOWN | Requires a runtime trace or acceptance record. |
| Acted through | NOT&#95;EXPOSED | UNKNOWN | Requires a runtime trace or acceptance record. |
| Checked | NOT&#95;EXPOSED | UNKNOWN | Requires a runtime trace or acceptance record. |
| Accepted | NOT&#95;EXPOSED | UNKNOWN | Requires a runtime trace or acceptance record. |

## Cleanup decisions

### First recommendations

- **Keep it &#40;KEEP&#41;: Claude Code permissions &#43; backup hooks &#40;.claude/settings.json&#41;**
  - Why: This is the actual enforcement mechanism behind CLAUDE.md's 'origin/main is a backup' protocol — a real hook, not just written guidance. It turns a stated rule into a working check, which is the desired pattern.
  - Evidence: VERIFIED
- **Put it on probation &#40;PROBATION&#41;: Local permission overrides &#40;.claude/settings.local.json&#41;**
  - Why: Claude Code's own convention is that settings.local.json is a personal, uncommitted override layer over settings.json, so this overlap may be expected rather than drift. But the evidence here can't distinguish 'intentional personal layer' from 'accidental duplicate' without asking.
  - Evidence: INFERRED
- **Keep it &#40;KEEP&#41;: Standing project instructions &#40;CLAUDE.md&#41;**
  - Why: Well&#45;structured standing instructions&#58; each protocol states its origin/rationale, points to a supporting memory file, and the six architectural invariants are stated as settled decisions with 'don't relitigate' guidance. This is exactly the shape a project CLAUDE.md should have.
  - Evidence: VERIFIED

### Full decision table

| Control | Decision | Evidence | Reason |
|---|---|---|---|
| Claude Code permissions &#43; backup hooks &#40;.claude/settings.json&#41; | Keep it &#40;KEEP&#41; | VERIFIED | This is the actual enforcement mechanism behind CLAUDE.md's 'origin/main is a backup' protocol — a real hook, not just written guidance. It turns a stated rule into a working check, which is the desired pattern. |
| Local permission overrides &#40;.claude/settings.local.json&#41; | Put it on probation &#40;PROBATION&#41; | INFERRED | Claude Code's own convention is that settings.local.json is a personal, uncommitted override layer over settings.json, so this overlap may be expected rather than drift. But the evidence here can't distinguish 'intentional personal layer' from 'accidental duplicate' without asking. |
| Standing project instructions &#40;CLAUDE.md&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Well&#45;structured standing instructions&#58; each protocol states its origin/rationale, points to a supporting memory file, and the six architectural invariants are stated as settled decisions with 'don't relitigate' guidance. This is exactly the shape a project CLAUDE.md should have. |
| Handoff prompt — 2026&#45;06&#45;22 &#40;Globe &amp; Entity UX kickoff&#41; | Retire it safely &#40;RETIRE&#41; | VERIFIED | This prompt's own successor chain shows it is fully obsolete&#58; the 2026&#45;07&#45;04 handoff explicitly says the 06&#45;22 roadmap 'kicked off' the work and slices have since progressed, and MEMORY.md separately states the 2026&#45;06&#45;22 roadmap's slice list is now 'exhausted' and was 'succeeded' by the 2026&#45;07&#45;15 Trips &amp; Travel work. Nothing currently points to this file as canonical. |
| Handoff prompt — 2026&#45;07&#45;04 &#40;resume Step 7&#41; | Retire it safely &#40;RETIRE&#41; | VERIFIED | The 2026&#45;07&#45;07&#45;claude&#45;code&#45;handoff&#45;prompt.md file explicitly states in its own header line that it 'Supersedes docs/plans/2026&#45;07&#45;04&#45;claude&#45;code&#45;handoff&#45;prompt.md' — this is a self&#45;declared, verified supersession, not an inference. |
| Handoff prompt — 2026&#45;07&#45;07 post&#45;Slice&#45;7 &#40;roadmap exhausted&#41; | Put it on probation &#40;PROBATION&#41; | INFERRED | The file isn't contradicted or wrong, it's just aged past the project's current state per the build&#45;progress log. Evidence for 'still safe to use as&#45;is' vs 'now actively misleading' is inferred, not directly tested, so PROBATION rather than RETIRE. |
| Handoff prompt — 2026&#45;07&#45;07 &#40;resume at Slice 7&#41; | Retire it safely &#40;RETIRE&#41; | VERIFIED | The file docs/plans/2026&#45;07&#45;07&#45;claude&#45;code&#45;handoff&#45;prompt&#45;post&#45;slice7.md explicitly states in its own first paragraph that it 'Supersedes docs/plans/2026&#45;07&#45;07&#45;claude&#45;code&#45;handoff&#45;prompt.md &#40;whose task — Slice 7 — is now BUILT&#41;'. This is the file's own declared status, directly verified. |
| Chronicle Exchange Format schema &#40;documentation/early&#45;planning&#45;v2/cef&#45;schema.json&#41; | Put it on probation &#40;PROBATION&#41; | INFERRED | CLAUDE.md's canonical schema pointer is documentation/schema&#95;v1.sql, not this file, and nothing in the memory index links to early&#45;planning&#45;v2/. Folder naming and absence from the index both suggest this predates the current PRD v1.1/schema v1.4 baseline, but that's an inference, not a verified supersession statement like the handoff prompts had. |
| Entity extraction tool definition &#40;lib/agents/entity/tool.ts&#41; | Keep it &#40;KEEP&#41; | VERIFIED | This is a real, in&#45;use tool definition shared between the synchronous Orchestrator path and the async entity&#45;agent listener &#40;'dual&#45;mode pattern&#58; one core, two callers', per its own comment&#41; — a clean single&#45;source&#45;of&#45;truth pattern, not duplicated logic. |
| Tagger tool definition &#40;lib/agents/tagger/tool.ts&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Same shared&#45;core dual&#45;mode pattern as the entity tool&#58; one definition, two callers &#40;inline orchestrator &#43; async listener&#41;, which is the correct way to give a control one job and one home. |
| Capture Agent listener &#40;lib/inngest/agents/capture&#45;agent.ts&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Small, single&#45;purpose, and its own comment correctly documents both its current behavior and a noted future change &#40;moving the INSERT here under a restricted DB role in multi&#45;tenant production&#41; — a good example of intent being stated rather than assumed. |
| Entity Agent listener &#40;lib/inngest/agents/entity&#45;agent.ts&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Correctly implements the documented dedupe gate so draft memories aren't double&#45;processed before the user accepts them — the skip flag and the Orchestrator's inline preview are consistent with each other. |
| Globe Extraction Agent listener &#40;lib/inngest/agents/globe&#45;extraction&#45;agent.ts&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Its own comment documents the idempotency property &#40;re&#45;extraction only surfaces new names&#41; and the async&#45;by&#45;design rationale, matching the async pattern used by the other agents. |
| Tagger Agent listener &#40;lib/inngest/agents/tagger&#45;agent.ts&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Same correct dedupe&#45;gate pattern as entity&#45;agent, applied consistently. |
| Decision&#58; Phase 0 reframing &#40;2026&#45;05&#45;31&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Properly indexed, dated, and labeled as historical rationale rather than active instruction — exactly the intended job for a resolved&#45;history memory file. |
| Decision&#58; Step 7 image storage &#40;2026&#45;06&#45;04&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Content is a legitimate point&#45;in&#45;time decision record; the only gap is it isn't separately indexed the way other decision&#95;&#42; files are, which is a minor discoverability note rather than a defect. |
| Decision&#58; Step 7 prep checklist &#40;2026&#45;06&#45;04&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Consistent with the other decision&#95;&#42; files' role as dated, retained build history. |
| Decision&#58; Step 7 slice phasing &#40;2026&#45;06&#45;05&#41; | Keep it &#40;KEEP&#41; | VERIFIED | This is a good example of the intended pattern&#58; rather than deleting a partially&#45;superseded file, MEMORY.md's index entry precisely states what's superseded &#40;sequencing&#41; versus what's retained &#40;specific design calls&#41;, so a reader isn't misled. |
| Feedback&#58; folder naming &#40;lowercase&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Small, single&#45;purpose, non&#45;controversial tooling constraint, correctly indexed. |
| Feedback&#58; memory dual&#45;write protocol &#40;origin&#41; | Keep it &#40;KEEP&#41; | VERIFIED | This file should remain the canonical origin/rationale record &#40;it documents the April 2026 drift incident that motivated the protocol&#41;; CLAUDE.md remains the operative instruction; README.md is the one recommended for trimming. |
| Feedback&#58; no build during dev | Keep it &#40;KEEP&#41; | VERIFIED | Concrete, actionable operational guardrail with a clear recovery procedure — a good MAKE&#95;A&#95;CHECK candidate in principle &#40;a pre&#45;command hook could block 'npm run build' while a dev server is detected&#41;, but that would be a new capability to propose, not a cleanup of what exists today. |
| Feedback&#58; origin backup auto&#45;push | Keep it &#40;KEEP&#41; | VERIFIED | Directly supports and explains the enforcement mechanism in .claude/settings.json; origin/rationale and mechanism are properly separated across two files. |
| Feedback&#58; silent backup &#43; remote sandbox | Keep it &#40;KEEP&#41; | VERIFIED | This is exactly the kind of failure record that should stay in memory — it explains a subtle, previously&#45;invisible failure mode, and the Stop hook in .claude/settings.json is the resulting MAKE&#95;A&#95;CHECK for it. |
| Memory index &#40;memory/MEMORY.md&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Well&#45;maintained&#58; dated at top, explicitly names its own most&#45;recent update, and each entry gives a one&#45;line status plus supersession notes &#40;e.g. 'succeeded the exhausted 2026&#45;06&#45;22 roadmap slice list'&#41;. This is the strongest single control in the whole harness for 'give every control one job, home, and owner.' |
| Project&#58; Access Cards framework | Keep it &#40;KEEP&#41; | VERIFIED | Directly supports a stated architectural invariant; content and CLAUDE.md pointer are consistent. |
| Project&#58; architecture split &#40;voice vs video&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Properly filed under resolved&#45;history; content matches its MEMORY.md summary. |
| Build progress log &#40;memory/project&#95;lc&#95;build&#95;progress.md&#41; | Put it on probation &#40;PROBATION&#41; | VERIFIED | The file already follows the right pattern &#40;newest info at the top, dated headers, explicit 'read first' framing&#41;, so this isn't a KEEP&#45;vs&#45;RETIRE question — it's a growth&#45;risk PROBATION&#58; at 996 lines and climbing every session, the 'point of need' load will keep getting larger unless archived periodically. Evidence for the risk is verified &#40;file size measured directly&#41;; evidence for whether archiving is worth the disruption is not yet tested. |
| Project&#58; Capture Assistant &#43; Orchestrator | Keep it &#40;KEEP&#41; | VERIFIED | Correctly structured as a summary&#45;with&#45;pointer rather than a duplicate of the canonical doc. |
| Project&#58; DB architecture decisions | Keep it &#40;KEEP&#41; | VERIFIED | Directly supports a stated architectural invariant with consistent content. |
| Project&#58; document sources &#40;Drive vs local&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Small, clear&#45;purpose reference file. |
| Project&#58; dual&#45;track final review commitment | Keep it &#40;KEEP&#41; | VERIFIED | Clear, dated, forward&#45;looking commitment with a defined trigger &#40;end of development&#41; — appropriately a PROBATION&#45;free KEEP since it's a simple standing note, not a control with ambiguous freshness. |
| Project&#58; extraction reliability &amp; context&#45;layer boundary | Keep it &#40;KEEP&#41; | VERIFIED | Specific, testable behavioral documentation tied to a real commit &#40;7ef6b96&#41; and a named script — strong evidence quality. |
| Project&#58; future pin types &#40;deferred&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Correctly labeled as deferred/aspirational, preventing it from being mistaken for current scope. |
| Project&#58; April 2026 gap review &#40;historical&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Correctly filed as historical with its retained value explicitly stated in the index. |
| Project&#58; Globe &amp; Entity UX brief &#40;2026&#45;06&#45;22&#41; | Keep it &#40;KEEP&#41; | VERIFIED | MEMORY.md's annotation already does the disambiguation work &#40;this file = intent, roadmap doc = sequencing&#41;, matching the intended pattern for a brief that later got refined. |
| Project&#58; location as three&#45;layer design | Keep it &#40;KEEP&#41; | VERIFIED | Clear architectural rule, consistently referenced. |
| Project&#58; ontology bootstrap | Keep it &#40;KEEP&#41; | VERIFIED | Directly supports a stated architectural invariant; MEMORY.md notes it was updated 2026&#45;05&#45;17 for the parallel&#45;strand model, consistent with CLAUDE.md's current description. |
| Project&#58; pre&#45;PRD readiness decisions &#40;resolved&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Properly filed under resolved&#45;history with a resolution date. |
| Project&#58; current state — PRD v1.1, schema v1.4 | Keep it &#40;KEEP&#41; | VERIFIED | Correctly positioned as the first thing to read; consistent with CLAUDE.md's Key Documents table. |
| Project&#58; five shareable artifacts | Keep it &#40;KEEP&#41; | VERIFIED | Clear taxonomy file, consistently referenced elsewhere. |
| Project&#58; Single Post Share | Keep it &#40;KEEP&#41; | VERIFIED | Specific, implementable design decision, consistently scoped. |
| Project&#58; The Stroll &#40;reminiscence mode&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Directly supports a stated architectural invariant with consistent content and a canonical spec pointer. |
| Project&#58; Temporal Agent design | Keep it &#40;KEEP&#41; | VERIFIED | Directly supports a stated architectural invariant. |
| Memory folder explainer &#40;memory/README.md&#41; | Give it one home &#40;ONE&#95;HOME&#41; | VERIFIED | The same dual&#45;write rule currently has three homes&#58; CLAUDE.md &#40;operative instruction Claude actually follows&#41;, feedback&#95;lc&#95;memory&#95;dual&#95;write.md &#40;origin/incident rationale&#41;, and this README &#40;human explainer&#41;. None of the three copies is wrong, but a future edit to the rule now has to be made in three places to stay consistent — exactly the duplicated&#45;ownership pattern the six cleaning principles flag. |
| Reference&#58; designer skills | Keep it &#40;KEEP&#41; | VERIFIED | MEMORY.md's entry already documents that the project&#45;local copy was intentionally removed in favor of a global skills location — a completed LOAD&#95;LATER&#45;style migration, correctly recorded rather than left ambiguous. |
| Reference&#58; development sequence &#40;15&#45;step plan&#41; | Keep it &#40;KEEP&#41; | VERIFIED | Central reference doc, consistent with build&#95;progress.md's current&#45;state description. |
| Reference&#58; migration apply procedure | Keep it &#40;KEEP&#41; | VERIFIED | Directly supports CLAUDE.md's Migration Safety Checkpoint protocol with the concrete mechanism. |
| Reference&#58; schema file locations | Keep it &#40;KEEP&#41; | VERIFIED | Useful navigational reference; its scope overlaps usefully &#40;not redundantly&#41; with MEMORY.md. |
| User&#58; Andy profile | Keep it &#40;KEEP&#41; | VERIFIED | Standard, appropriately&#45;scoped user&#45;preference memory file. |
| Supabase generated configuration &#40;supabase/config.toml&#41; | Keep it &#40;KEEP&#41; | VERIFIED | This file was flagged by the scanner's path heuristics &#40;high 'external&#95;action' signal count from URLs/ports in the config&#41; but is ordinary product configuration, not part of the AI harness proper; no cleanup action applies. |

## Coverage

| Area | Evidence state | Detail |
|---|---|---|
| visible local instruction and control files | VERIFIED | Files matching the bounded scanner rules were inventoried without executing their contents. |
| selected surface and model labels | USER&#95;REPORTED | The caller identified the surface as 'claude&#45;code' and the model as 'USER&#95;REPORTED'; the scanner did not verify either runtime value. |
| control kind, apparent job, and static signals | INFERRED | Path metadata and bounded text signals suggest intent; semantic review is required before a cleanup recommendation. |
| runtime activation and load order | INACCESSIBLE | Actual availability, eligibility, loading, and consultation require a product trace or run receipt that the static scanner does not have. |
| hidden product instructions, routing, memory, and account settings | INACCESSIBLE | The local scanner cannot inspect controls the product surface does not expose as files or supplied exports. |
| behavioral value and model performance | NOT&#95;APPLICABLE | This is a static inventory, not a behavioral evaluation or model comparison. |

## Evidence-state key

- **VERIFIED:** Directly observed in the bounded evidence available to this report.
- **USER_REPORTED:** Supplied by the caller but not independently verified.
- **INFERRED:** Suggested by static evidence; runtime behavior was not observed.
- **INACCESSIBLE:** The surface or selected scope did not expose the evidence.
- **NOT_APPLICABLE:** The static scan cannot answer this type of question.

Generated: 2026&#45;07&#45;17T04&#58;50&#58;56&#43;00&#58;00
