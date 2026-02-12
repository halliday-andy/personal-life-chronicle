# Personal Life Chronicle

**A personal AI-powered memory system that transforms your media library into a searchable, explorable knowledge graph of your life.**

---

## Vision

The Personal Life Chronicle preserves not just what happened, but **who was there, where it occurred, how people relate to each other, and the stories that give it all meaning**.

A digital chronicle that grows with you across decades, maintaining the social fabric and narrative context of your personal history.

---

## Project Status

🔵 **Planning Phase** - PRD Complete

See [`Personal-Life-Chronicle-PRD.docx`](./Personal-Life-Chronicle-PRD.docx) for complete vision and technical specifications.

---

## Components

### 📹 Video Editing - Creative Edit Suite
**Status:** In active development (Phases 1-3 complete)
**Location:** `../Creative-Edit-Suite/`

The video editing component with entity and facial recognition.

### 📸 Photo & Image Management
**Status:** Not started
Organize and search photos with face recognition and location awareness.

### 📄 Document Organization
**Status:** Not started
Connect documents to timeline and events.

### 📅 Timeline & Life Events
**Status:** Not started
Map important moments, milestones, and events across your life.

### 🎙️ Memory Capture
**Status:** Not started
Record voice notes and context to preserve stories beyond what media shows.

### 👥 Relationship Mapping
**Status:** Not started
Social graph showing family, friends, and connections across generations.

---

## Key Differentiators

- ✅ **Temporal Awareness** - Tracks people across life stages (age 5 → 25)
- ✅ **Social Context** - Relationships and connections matter
- ✅ **Narrative Richness** - Context beyond what video/photos show
- ✅ **Multi-Generational** - Preserves family history across generations
- ✅ **Privacy-First** - Your data, your control
- ✅ **Future-Proof** - Standard formats (GEDCOM, JSON-LD)

---

## Use Case Examples

### Home Video Library
*"Show me all videos with Emma and her grandmother"*
*"Find family gatherings at the lake house between 2010-2015"*
*"All videos from Sarah's childhood that mention birthdays"*

### Photo Archives
*"Photos of my daughter's friends from elementary school"*
*"All pictures taken at Grandma's house"*
*"Family vacations to California"*

### Document Memory
*"Tax returns from when we bought the house"*
*"School reports and report cards"*
*"Letters from grandparents"*

---

## Implementation Phases

See PRD for detailed 12-phase implementation plan:

**Phases 1-7:** Video Component (Creative Edit Suite) - IN PROGRESS
**Phases 8-12:** Life Chronicle Features - PLANNED

- Phase 8: Relationship Mapping
- Phase 9: Life Events & Milestones
- Phase 10: Narrative Annotations
- Phase 11: Timeline Visualization
- Phase 12: Archive & Export

---

## Technical Architecture

**Foundation:**
- PostgreSQL with pgvector for entity/face embeddings
- Multi-modal AI (Gemini, OpenAI, face-api.js)
- Knowledge graph with entities, relationships, events

**Future:**
- Photo analysis and organization
- Document OCR and classification
- Voice transcription for memory capture
- Family tree integration (GEDCOM)

---

## Relationship to Creative Edit Suite

The Creative Edit Suite is the **video editing component** of this larger vision. It provides:
- Video atomization and search
- Entity recognition
- Facial recognition across decades
- Timeline-based video organization

Personal Life Chronicle **adds:**
- Other media types (photos, documents)
- Relationship mapping
- Life events and milestones
- Narrative annotations
- Multi-generational family tree

---

**Last Updated:** 2026-02-12
**Full Specification:** [`Personal-Life-Chronicle-PRD.docx`](./Personal-Life-Chronicle-PRD.docx)
