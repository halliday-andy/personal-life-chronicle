---
name: Life Chronicle architectural split — resolved
description: Two diverging product threads (voice-first capture vs. video-first media intelligence) were reconciled April 2026. Voice/interview is the primary entry point; video is a Phase 2/3 input modality. This file is retained for the resolution and the durable schema-extensibility constraint that emerged.
type: project
originSessionId: 07968d59-e854-49c3-bbf3-2ce8d72c13e0
---

## Resolution (April 2026)

The conversational interview is the primary capture path. The interview-driven extraction of the personal schema (places, careers, relationships, interests, milestones) produces a unique per-user graph that becomes the organizing framework. All other media types — video, photos, documents, audio files — attach to nodes that already exist in that graph as evidence and enrichment.

**Video atomization / facial recognition is deferred to Phase 2–3** (see prd_readiness Decision 1). Not abandonment — it becomes a rich input modality once the schema exists to receive it.

The two prior product threads:
- **Voice/Narrative Capture** (Google Drive, 2024 – Oct 2025): SMS-based AI agent, async voice responses, Whisper transcription, taxonomy-driven planner. → This is the architecture the MVP builds on.
- **Video Media Intelligence** (Feb 2026 PRD.docx): Video upload, facial recognition, knowledge graph from media. → Archived to `documentation/archive/`. Phase 2/3 modality.

## Durable schema-extensibility constraint

This was the architectural lesson that survived the merge of threads: **the schema must be flexible/extensible by design.** New dimensions not anticipated at outset must be addable without migration. New timeline entries must be insertable retroactively. Relationships between entities must be revisable as user understanding deepens.

This is why dimensions are a self-referencing tree (rows, not ENUM values), why entities have a parent chain for geographic hierarchy, and why ENUMs are being converted to controlled-vocabulary tables wherever extension is foreseeable. New life dimensions are a row insert, never a schema migration.

## How to apply

When advising on architecture, prioritize the interview/voice capture system. Frame video and other media as input modalities that enrich an existing schema. Always design for schema extensibility — new dimensions, new entity types, new relationship types must be addable at any time without DDL.
