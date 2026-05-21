---
name: Life Chronicle — April 2026 gap review (historical, retained for durable hypotheses)
description: Opus 4.7 design review of schema_v1 + architecture doc. All 14 identified gaps and 5 open decisions are now resolved in PRD v1.1 + schema v1.3. Retained here for the four MVP hypotheses and the durable architectural lessons that emerged.
type: project
originSessionId: b2a30b2d-fc2f-4ca5-bfaf-2f6dc2a43ae1
---

## Status

Historical. All 14 gaps and 5 open decisions resolved by 2026-04-30. PRD v1.1 + schema v1.3 + access_cards_requirements.md absorb the outcomes. This file retains the durable lessons that should not be re-derived.

## The four MVP hypotheses (still active — the chronicle must test these)

- **H1.** Non-technical adults complete Phase 0 if value emerges mid-flight (artifact after each stage, not after all stages).
- **H2.** Users return weekly under prompt cadence.
- **H3.** AI synthesis feels accurate enough to share with people they care about.
- **H4.** Users trust the privacy model with one genuinely sensitive memory.

These are the success criteria the MVP must validate. Every UX and prioritization decision should be checked against them.

## Durable architectural lessons from the gap review

- **Raw vault sanctity as a Postgres role, not just documented intent.** The Capture Agent's DB role is INSERT-only on `memories`; UPDATE privilege is not granted. This makes "AI never edits raw memories" a permissions fact rather than application discipline. (Implementation deferred for local alpha but the principle stands.)
- **Cost guardrails are architectural, not ops.** Rate-limited synthesis regeneration, batched generation policy, per-user monthly $ ceilings. Treated as first-class architecture decisions, not deployment concerns.
- **Synthesis is pull-based and batched, not real-time cascade.** Real-time regeneration on every source change is too expensive; staleness is acceptable and surfaced as `is_current = false`.
- **Mid-flight Phase 0 artifacts are non-negotiable.** Non-technical adults will not complete a 90-minute onboarding before seeing anything. Each Phase 0 stage produces a visible artifact (Life Globe after Stage 1, Entity Portrait after Stage 2, Life's Players after Stage 3).
- **Eval scaffold from day one, not as Phase 2 polish.** Thumbs on syntheses, prompt versioning, weekly low-rated review — built in from the first synthesis the system ships.
- **Assumption log promoted to first-class now.** Every agent inference writes to `assumption_log`. Provenance/trust promises require this; cannot be retrofitted later.

## Gaps that were closed (for the record, not re-derivation)

All 14 identified gaps addressed: assumption_log added; Inngest orchestration decided (architecture doc Part XVI); review_queue table added; `user_periods` added (though deferred from Phase 0 elicitation per Decision 3); soft-delete/redaction model designed; ENUM-vs-table extensibility addressed; second-person memory pattern modeled; training-consent layer designed (dormant in MVP); synthesis cost model defined (pull + batch); eval scaffold (synthesis_evals); coverage scoring algorithm specified; video PRD retired; subscription/tenancy sketched.

## How to apply

When facing a question whose answer touches one of the four MVP hypotheses, weight the decision toward validating that hypothesis. When facing an architectural choice that mirrors one of the durable lessons above, the lesson is the answer — don't re-litigate.
