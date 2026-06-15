# Interview Dialogue → Recollections → Synthesis → Biography

**Date:** 2026-06-14
**Status:** Design validated with Andy. **DEFERRED — explicitly post-MVP.**
**Why deferred:** This is a narrative-biography *editing/presentation* enhancement, not a capture primitive. Andy's MVP proofing of platform use cases does not depend on it. The design is captured here so the thinking survives; build it after the MVP use cases are exercised.

---

## The vision: the journalist model

The capture assistant plays a **journalist** — it elicits material through conversation, then "reports it out" as readable narrative **with the interviewee's actual quotations preserved**. Three layers, each distinct and already present (in whole or scaffold) in the architecture:

1. **Raw Vault (verbatim answers)** — the user's actual words, immutable once finalized (invariant #1). The interviewee quotes.
2. **Synthesis layer (`syntheses`)** — the journalist's "report": narrative that *weaves* the verbatim quotes into something coherent. Derived; never merged back into the Raw Vault.
3. **Biography / publication layer** — the compact, edited, viewable history others can read without wading through the turn-by-turn Q&A. The "five shareable artifacts" + Single Post Share surface.

The capture flow today fills layer 1 turn-by-turn but does **not** (a) preserve the interviewer's question with the answer, (b) deliberately synthesize a dialogue, or (c) propagate Raw Vault corrections into derived narratives. This spec covers all three.

---

## Decisions (validated with Andy)

### D1 — Whose words is a recollection made of? → **Both, as layers (option C).**
The user's **verbatim turns** become Raw Vault recollections. An **AI synthesis** that quotes them becomes a separate *derived* artifact in the synthesis layer. The sacred layer stays truly the user's; the AI never authors a Raw Vault entry.

### D2 — How is the prompting question preserved? → **Both metadata and a session transcript (option C).**
- Each answer-memory carries its prompting question in `metadata.interview_question` (and ideally `metadata.interview_session_id`). This makes each recollection legible **standalone** — essential because synthesis agents JOIN one memory at a time.
- A **session record** holds the full ordered thread (every Q and A). Answer-memories reference their turn. This preserves the journalist's full arc for biography generation and "replay the interview."

### D3 — When does a dialogue turn become a recollection? → **Hybrid quiet-capture + shape-on-close (option C).**
- Each substantive answer is captured **verbatim and quietly** as a draft (question in metadata) — no proposal card interrupting every sentence; the conversation stays fluid. Captures accrue for later review in `/memories` (which already provides draft review/correct).
- When a thread reaches a natural close (or on user signal), the assistant **offers to weave** the captured answers into a synthesis "report" — a synthesis-layer artifact, **not** a new Raw Vault entry.

### D4 — Edit & propagate (the revise-and-publish loop).
- **Editing the Raw Vault is state-gated, not a free choice:** a **draft** memory's `content_raw` is editable in place (composition grace period); a **finalized** memory freezes — corrections write a **`memory_revisions`** record that layers over the original, which is preserved forever (The Stroll Pathway C, invariant #6). The globe edit panel already enforces this pattern.
- **Synthesis propagation:** when an underlying memory is revised, syntheses built from it go **stale** (`synthesis_stale` review-queue type + `synthesis/invalidated` event exist). The intended loop: flag affected synthesis → regenerate reading the **latest revision** (synthesis agents must JOIN `memory_revisions`, invariant #6) → surface the updated language as a **proposal the user approves or modifies** — never a silent rewrite of a published narrative.

---

## Data model implications

- `memories.metadata.interview_question` (text) + `memories.metadata.interview_session_id` (uuid). Additive, no migration beyond convention.
- A **session container** for a multi-turn capture-assistant conversation. Candidates: extend `capture_submissions` (currently one row per submission) to group by a session id, or use `interview_sessions` (exists, has `focus_entity_id`). Decide at build time; the transcript must store ordered (role, content) turns.
- Synthesis staleness + provenance: a synthesis must know which memory ids (and which revision generations) it was built from, so a revision can flag exactly the affected syntheses. Check `syntheses` for a source-memory-ids column; add if absent.

## What exists vs. what's to build

- **Exists/scaffolded:** Raw Vault + drafts + finalize; `memory_revisions` (non-destructive corrections, enforced in the globe edit panel); `syntheses` table + three synthesis-agent stubs; `synthesis/invalidated` event; `synthesis_stale` review-queue type; capture assistant maintains + sends `conversation_history`.
- **To build:** question preservation in metadata; the session transcript container; quiet per-answer capture (vs. today's per-turn proposal); the "shape this dialogue into a synthesis" action; the full revise→stale→regenerate→**propose updated language**→approve propagation loop; the biography/publication compaction.

## Suggested future slicing (when un-deferred)

1. **Question preservation** — write `metadata.interview_question` on dialogue-derived memories; show it on the memory card. Small, immediately useful.
2. **Session transcript** — group a conversation; let the user replay/review it.
3. **Synthesize-on-close** — the "report this out" action producing a synthesis artifact that quotes verbatim memories.
4. **Revise-and-propagate** — staleness → regenerate-from-revisions → approval proposal.
5. **Biography/publication** — compaction into a shareable, readable artifact.

## MVP boundary (explicit)

None of the above is required for Andy's MVP use-case proofing. Today's behavior (each substantive answer may become its own verbatim draft, reviewed in `/memories`) is sufficient for capture. This spec is the target for the **narrative-biography editing step**, to be built after the MVP is exercised. Cross-references: invariants #1 and #6 (project `CLAUDE.md`), `project_lc_stroll_feature.md`, `project_lc_shareable_artifacts.md`, `project_lc_single_post_share.md`.
