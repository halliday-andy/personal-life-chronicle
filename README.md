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

## Maintenance — Runtime version pinning

This repo pins the Node.js runtime to a specific LTS line via `.nvmrc` and the `engines` field of `package.json`. The pin is **intentional** and exists for two reasons:

1. **Avoiding bleeding-edge V8 bugs.** Next.js + webpack interact with Node.js's V8 optimisations. Newer odd-numbered Node releases (21, 23, 25, …) periodically introduce V8 changes that crash Next.js's dev server with errors like `Lazy deopt after a fast API call with return value is unsupported`. The first occurrence in this project was on Node 25 (2026-05-22). LTS lines are battle-tested against Next.js before they ship.
2. **Reproducibility across machines.** Anyone cloning the repo runs `nvm use` and gets the correct runtime automatically.

### Current pin (as of 2026-05-22)

| File | Value |
|---|---|
| `.nvmrc` | `24` |
| `package.json` `engines.node` | `^24.0.0` |

Node 24 LTS — active LTS through October 2026, maintenance through April 2028.

### When to revisit the pin

Bump the pin when any of these happen:

| Trigger | Action |
|---|---|
| Node 24 reaches end-of-life (April 2028) | Move to the next LTS line (likely Node 26 or 28). |
| We upgrade Next.js (14 → 15 → 16) | Check the Next.js release notes for the recommended Node version. Test with `nvm install <version> && nvm use <version> && npm install && npm run build`. |
| A dependency drops Node 24 support | Forces an earlier upgrade. |
| A security CVE in Node 24 with no patch | Forces an emergency upgrade. |

### Upgrade procedure (~30 minutes)

```bash
# 1. Install the candidate version
nvm install 26       # or whatever the new target is
nvm use 26

# 2. Clean rebuild
rm -rf node_modules .next
npm install
npx tsc --noEmit
npm run build

# 3. If clean: lock it in
echo "26" > .nvmrc
# edit package.json: engines.node → "^26.0.0"

# 4. Run the orchestrator smoke test against the live DB
node scripts/test-orchestrator.mjs short

# 5. Commit and push
git add .nvmrc package.json package-lock.json
git commit -m "chore: bump Node pin from 24 → 26 (Next.js N.x compatibility)"
```

The version history of this pin (always visible via `git log -- .nvmrc`) doubles as the upgrade audit trail.

### CI guard

`.github/workflows/ci.yml` runs `npm install`, `tsc --noEmit`, and `next build` on every push using the pinned Node version. A failed build on the pinned version surfaces at PR time, not when the dev server crashes during a Tuesday evening capture session.

---

**Last Updated:** 2026-02-12
**Full Specification:** [`Personal-Life-Chronicle-PRD.docx`](./Personal-Life-Chronicle-PRD.docx)
