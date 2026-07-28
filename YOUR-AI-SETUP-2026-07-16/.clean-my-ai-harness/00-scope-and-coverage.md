# Scope and Coverage

Review ID: HARNESS-92E08F9AD4-FECEB22390  
Target: Personal&#45;Life&#45;Chronicle  
Edition: Claude  
Reported surface: claude&#45;code (USER&#95;REPORTED)  
Reported model: USER&#95;REPORTED (USER&#95;REPORTED)  
Baseline scope SHA-256: `feceb22390a486642cab8306609c98acab88f23602bd324b7ee9fdc8417b7137`  
Baseline map SHA-256: `92e08f9ad4e1797cad310aaa39c784d6b247edd6a78eb386013989c9697ac0b2`

## What was reviewed

- Visible controls: 55
- Controls semantically reviewed: 50
- Controls left unreviewed: 5
- Review mode: QUICK&#95;CHECK
- Change permission: READ ONLY. This packet proposes changes; it applies none.

## Coverage

| Area | Evidence | What that supports |
|---|---|---|
| visible local instruction and control files | VERIFIED | Files matching the bounded scanner rules were inventoried without executing their contents. |
| selected surface and model labels | USER&#95;REPORTED | The caller identified the surface as 'claude&#45;code' and the model as 'USER&#95;REPORTED'; the scanner did not verify either runtime value. |
| control kind, apparent job, and static signals | INFERRED | Path metadata and bounded text signals suggest intent; semantic review is required before a cleanup recommendation. |
| runtime activation and load order | INACCESSIBLE | Actual availability, eligibility, loading, and consultation require a product trace or run receipt that the static scanner does not have. |
| hidden product instructions, routing, memory, and account settings | INACCESSIBLE | The local scanner cannot inspect controls the product surface does not expose as files or supplied exports. |
| behavioral value and model performance | NOT&#95;APPLICABLE | This is a static inventory, not a behavioral evaluation or model comparison. |

## What I Could Not See

- **hidden&#45;product&#45;controls (INACCESSIBLE):** Hidden system instructions, product routing, account memory, and unexported settings were not visible.
- **runtime&#45;trace (INACCESSIBLE):** No trace showed which controls were eligible, shown, consulted, acted through, checked, or accepted for a real job.
- **behavioral&#45;effect (NOT&#95;APPLICABLE):** Static presence and text signals do not prove that a control helps or harms the work.
- **excluded&#45;paths (INACCESSIBLE):** Some paths were deliberately excluded for privacy, safety, traversal, or relevance limits.
- **Unused/stub Inngest agent functions and one build&#45;tool config file (VERIFIED):** planner&#45;agent.ts, search&#45;agent.ts, timeline&#45;agent.ts, and all three synthesis&#45;agent.ts functions are verified stubs &#40;each just logs 'stub invoked' and returns a status string, per direct file read&#41; not yet wired to real logic; tailwind.config.ts is ordinary build tooling with no instructional content. Reviewing these individually would not change any recommendation, and the Quick Check bound &#40;50 reviewed controls&#41; was reached by the other 50 controls, which include every file with actual authority, routing, or standing&#45;context signal. Recommend a Maintainer Audit only if Andy wants these formally logged.
- **Runtime activation and load order for every control (INACCESSIBLE):** This is a static file inventory. No run trace or product receipt was available, so for every file above 'KEEP' means 'this file's content is sound and its stated job is clear' — it does not mean 'this file was proven to load into a real Claude Code session.' CLAUDE.md's own auto&#45;load behavior is the one exception with reasonably strong inference &#40;Claude Code's documented project&#45;file convention&#41;, everything else's actual consultation is unverified.
- **documentation/early&#45;planning&#45;v2/ sibling files (INACCESSIBLE):** Only cef&#45;schema.json from this folder appeared in the scanner's 55&#45;control inventory; four sibling files in the same folder &#40;README&#95;Import&#95;Validation.txt, Revised&#95;PRD&#95;v2.md, handoff&#45;checklist.md, lovable&#45;build&#45;spec.v2.md&#41; were not surfaced by the bundled scanner under Quick Check's default file&#45;type rules. Their freshness status is therefore unassessed.
- **Hidden Claude Code product state (INACCESSIBLE):** Global &#40;non&#45;project&#41; skills, MCP server configuration, and any account&#45;level settings were out of scope for this project&#45;rooted scan, per the audit protocol's rule to map only the selected workspace root and its inherited configuration.
