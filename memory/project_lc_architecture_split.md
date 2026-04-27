---
name: Life Chronicle architectural split — open question
description: Two distinct codebases represent diverging input modalities; strategic direction now leaning toward interview-first unified approach
type: project
originSessionId: 07968d59-e854-49c3-bbf3-2ce8d72c13e0
---
There are two separately developed product threads that both belong to the Life Chronicle vision but came from different coding efforts and have meaningfully different architectures:

**Thread 1 — Voice/Narrative Capture (Google Drive, 2024–Oct 2025)**
- AI agent prompts user via SMS with taxonomy-driven questions
- User records async voice responses; Whisper ASR transcribes
- Planner tracks coverage across life taxonomy (career, relationships, childhood, etc.)
- Stack: Supabase + pgvector, React, Twilio, Lovable.dev build target
- Product name explored: MemRec
- Key docs: Revised_PRD_v2.md, Codex Strategy Doc, Gemini Taxonomy

**Thread 2 — Video Media Intelligence (Local working folder, Feb 2026 PRD.docx)**
- User uploads existing home video files
- Facial recognition + entity extraction builds knowledge graph
- People tracked across decades (aging), relationships mapped
- Stack: Supabase + pgvector, React, Gemini AI, face-api.js/InsightFace
- Built as extension of a separate "Creative Edit Suite" project already in development
- Key doc: Personal-Life-Chronicle-PRD.docx

**Strategic direction established (April 2026):**
Andy's instinct — confirmed — is that the conversational interview is the correct primary entry point. The interview-driven extraction of the personal schema (places lived, careers, relationships, interests, milestones, etc.) produces a unique per-user graph that becomes the organizing framework. All other media types — video, photos, documents, audio files — attach to nodes that already exist in that graph as evidence and enrichment, rather than requiring entity inference from raw media.

Video atomization/facial recognition work is **deferred** until the core interview system, timeline, and database schema are established. This is not abandonment of the video thread — it becomes a rich input modality once the schema exists to receive it.

**Database design constraint:**
The schema must be flexible/extensible by design. New dimensions not anticipated at outset must be addable without migration. New timeline entries must be insertable retroactively. Relationships between entities must be revisable as user understanding deepens. This argues for graph-ready relational structure (taxonomy nodes as first-class entities, not hardcoded columns).

**The open question (still unresolved):**
Whether the two threads ultimately become one product or two products that share a data layer. Deferred for deliberate conversation.

**How to apply:** When advising on architecture, prioritize the interview/voice capture system first. Frame video and other media as input modalities that enrich an existing schema. Always design for schema extensibility — new dimensions must be addable at any time.
