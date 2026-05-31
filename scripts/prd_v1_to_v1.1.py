"""
PRD v1 → v1.1 section replacement (Task #64b).
""" # noqa
from __future__ import annotations
"""

Rewrites five sections of documentation/Life_Chronicle_PRD_v1.docx
to match the navigation-surfaces reframing approved 2026-05-31.

Deviation from the docx skill convention: the skill recommends
hand-editing XML via the Edit tool rather than scripting. That
guidance is right for small targeted edits. The v1.1 revisions
span 5 sections totalling thousands of XML lines; hand-editing
would require 50+ fragile Edit calls. This script is the
pragmatic alternative — focused, single-purpose, and reviewable
in one pass.

Approach:
1. Parse word/document.xml with lxml (preserves namespace prefixes)
2. For each section heading text we want to replace, locate the
   <w:p> containing that heading and the next H1's <w:p>
3. Remove every sibling element between (exclusive of headings)
4. Insert new <w:p> / <w:tbl> elements in their place, constructed
   from minimal templates that match the original document's
   styling (Arial, custom colours)

Run:
    python3 scripts/prd_v1_to_v1.1.py /tmp/prd_unpacked
"""

import sys
from pathlib import Path
from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{" + W_NS + "}"
NSMAP = {"w": W_NS}


# -------------------------------------------------------------------
# Style constants — match the original document's Arial / colour palette
# -------------------------------------------------------------------

H1_COLOR = "1F4E79"   # deep blue
H2_COLOR = "2E75B6"   # mid blue
H3_COLOR = "2E75B6"
BODY_COLOR = "0D1B2A"  # near-black

H1_SIZE = "36"
H2_SIZE = "28"
H3_SIZE = "24"
BODY_SIZE = "22"
SMALL_SIZE = "20"


# -------------------------------------------------------------------
# Paragraph builders
# -------------------------------------------------------------------

def make_run(text: str, *, bold: bool = False, italic: bool = False,
             color: str = BODY_COLOR, size: str = BODY_SIZE,
             mono: bool = False) -> etree._Element:
    """Build a <w:r> with the given text and styling."""
    r = etree.Element(W + "r")
    rpr = etree.SubElement(r, W + "rPr")
    font = "Consolas" if mono else "Arial"
    etree.SubElement(rpr, W + "rFonts",
                     {W + "ascii": font, W + "cs": font,
                      W + "eastAsia": font, W + "hAnsi": font})
    if bold:
        etree.SubElement(rpr, W + "b")
        etree.SubElement(rpr, W + "bCs")
    if italic:
        etree.SubElement(rpr, W + "i")
        etree.SubElement(rpr, W + "iCs")
    etree.SubElement(rpr, W + "color", {W + "val": color})
    etree.SubElement(rpr, W + "sz", {W + "val": size})
    etree.SubElement(rpr, W + "szCs", {W + "val": size})
    t = etree.SubElement(r, W + "t", {"{http://www.w3.org/XML/1998/namespace}space": "preserve"})
    t.text = text
    return r


def make_paragraph(*runs, pStyle: str | None = None, spacing_after: str = "160",
                   spacing_before: str | None = None) -> etree._Element:
    """Build a <w:p> with the given runs and optional pStyle."""
    p = etree.Element(W + "p")
    pPr = etree.SubElement(p, W + "pPr")
    if pStyle:
        etree.SubElement(pPr, W + "pStyle", {W + "val": pStyle})
    spacing_attrs = {W + "after": spacing_after}
    if spacing_before is not None:
        spacing_attrs[W + "before"] = spacing_before
    etree.SubElement(pPr, W + "spacing", spacing_attrs)
    for r in runs:
        p.append(r)
    return p


def h1(text: str) -> list[etree._Element]:
    """Section heading (H1) — returns [heading p, divider p]."""
    heading = make_paragraph(
        make_run(text, bold=True, color=H1_COLOR, size=H1_SIZE),
        pStyle="Heading1", spacing_after="120", spacing_before="280",
    )
    divider = etree.Element(W + "p")
    dpPr = etree.SubElement(divider, W + "pPr")
    pBdr = etree.SubElement(dpPr, W + "pBdr")
    etree.SubElement(pBdr, W + "bottom",
                     {W + "val": "single", W + "color": "2E75B6",
                      W + "sz": "4", W + "space": "4"})
    etree.SubElement(dpPr, W + "spacing", {W + "after": "240"})
    return [heading, divider]


def h2(text: str) -> etree._Element:
    return make_paragraph(
        make_run(text, bold=True, color=H2_COLOR, size=H2_SIZE),
        pStyle="Heading2", spacing_after="120", spacing_before="280",
    )


def h3(text: str) -> etree._Element:
    return make_paragraph(
        make_run(text, bold=True, color=H3_COLOR, size=H3_SIZE),
        pStyle="Heading3", spacing_after="100", spacing_before="200",
    )


def body(text: str) -> etree._Element:
    return make_paragraph(make_run(text))


def body_italic(text: str) -> etree._Element:
    return make_paragraph(make_run(text, italic=True))


def bullet(text: str) -> etree._Element:
    """Bulleted list item using the document's existing numbering."""
    p = etree.Element(W + "p")
    pPr = etree.SubElement(p, W + "pPr")
    etree.SubElement(pPr, W + "pStyle", {W + "val": "ListParagraph"})
    numPr = etree.SubElement(pPr, W + "numPr")
    etree.SubElement(numPr, W + "ilvl", {W + "val": "0"})
    # numId=1 is a typical default bullet list; will be set by Word's numbering.xml
    etree.SubElement(numPr, W + "numId", {W + "val": "1"})
    etree.SubElement(pPr, W + "spacing", {W + "after": "60"})
    p.append(make_run(text))
    return p


def labeled_para(label: str, text: str) -> etree._Element:
    """Body paragraph with a bolded label prefix: 'Label: body text...'."""
    return make_paragraph(
        make_run(label + ": ", bold=True),
        make_run(text),
    )


# -------------------------------------------------------------------
# Table builders (for §6.3 review_queue spec)
# -------------------------------------------------------------------

def make_table(rows: list[list[str]], *, header: bool = True,
               col_widths: list[int] | None = None) -> etree._Element:
    """Build a simple bordered <w:tbl> from a list of rows.
    rows[0] is the header if header=True. col_widths default to equal."""
    n_cols = len(rows[0])
    if col_widths is None:
        col_widths = [9360 // n_cols] * n_cols

    tbl = etree.Element(W + "tbl")
    tblPr = etree.SubElement(tbl, W + "tblPr")
    etree.SubElement(tblPr, W + "tblW", {W + "w": "9360", W + "type": "dxa"})
    tblBorders = etree.SubElement(tblPr, W + "tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        etree.SubElement(tblBorders, W + side,
                         {W + "val": "single", W + "sz": "4",
                          W + "color": "CCCCCC"})
    tblGrid = etree.SubElement(tbl, W + "tblGrid")
    for w in col_widths:
        etree.SubElement(tblGrid, W + "gridCol", {W + "w": str(w)})

    for ri, row in enumerate(rows):
        tr = etree.SubElement(tbl, W + "tr")
        for ci, cell_text in enumerate(row):
            tc = etree.SubElement(tr, W + "tc")
            tcPr = etree.SubElement(tc, W + "tcPr")
            etree.SubElement(tcPr, W + "tcW",
                             {W + "w": str(col_widths[ci]), W + "type": "dxa"})
            if header and ri == 0:
                etree.SubElement(tcPr, W + "shd",
                                 {W + "val": "clear", W + "color": "auto",
                                  W + "fill": "D5E8F0"})
            p = make_paragraph(
                make_run(cell_text, bold=(header and ri == 0),
                         color=BODY_COLOR, size=BODY_SIZE),
                spacing_after="80",
            )
            tc.append(p)
    spacer = make_paragraph(make_run(""), spacing_after="160")
    return tbl, spacer


# -------------------------------------------------------------------
# Section locator + replacer
# -------------------------------------------------------------------

def find_paragraph_with_text(body_el: etree._Element, exact_text: str) -> etree._Element:
    """Find the first <w:p> whose concatenated <w:t> text equals exact_text."""
    for p in body_el.iter(W + "p"):
        texts = [t.text or "" for t in p.iter(W + "t")]
        if "".join(texts).strip() == exact_text.strip():
            return p
    raise ValueError(f"could not find paragraph with text: {exact_text!r}")


def replace_section(body_el: etree._Element, heading_text: str,
                    next_heading_text: str, new_elements: list[etree._Element],
                    new_heading_text: str | None = None) -> None:
    """Find [heading_text .. next_heading_text), remove the inner elements,
    insert new_elements right after heading_text's <w:p>.

    If new_heading_text is given, the heading paragraph's <w:t> is rewritten
    to that text (preserving the heading's own style). This is how we change
    section titles between versions (e.g. "3. Phase 0 — Multi-Session
    Onboarding" → "3. Phase 0 — Onboarding via the Three Navigation
    Surfaces") without recreating the heading paragraph's styling.
    """
    heading_p = find_paragraph_with_text(body_el, heading_text)
    next_p = find_paragraph_with_text(body_el, next_heading_text)
    parent = heading_p.getparent()

    start_idx = list(parent).index(heading_p)
    end_idx = list(parent).index(next_p)

    # Remove everything strictly between them (exclusive of both bounds).
    for el in list(parent)[start_idx + 1:end_idx]:
        parent.remove(el)

    if new_heading_text is not None:
        # Replace the heading's text — keep the first <w:t>, blank others.
        ts = list(heading_p.iter(W + "t"))
        if ts:
            ts[0].text = new_heading_text
            for t in ts[1:]:
                t.text = ""

    # Re-fetch start_idx because removals changed indices.
    start_idx = list(parent).index(heading_p)
    for i, new_el in enumerate(new_elements):
        parent.insert(start_idx + 1 + i, new_el)


def replace_version_line(body_el: etree._Element) -> None:
    """Replace 'Version 1.0  ·  May 2026' with v1.1 + revised status note."""
    v1_p = find_paragraph_with_text(body_el, "Version 1.0  ·  May 2026")
    parent = v1_p.getparent()
    idx = list(parent).index(v1_p)

    # The original sequence after this is:
    #   "Status: Draft for Review"
    #   "Owner: Andy Halliday"
    # Replace v1 line + status line; keep Owner line.
    status_p = parent[idx + 1]
    owner_p = parent[idx + 2]

    # Verify what we expect to replace.
    status_text = "".join(t.text or "" for t in status_p.iter(W + "t")).strip()
    owner_text = "".join(t.text or "" for t in owner_p.iter(W + "t")).strip()
    assert status_text == "Status: Draft for Review", f"unexpected status line: {status_text!r}"
    assert owner_text == "Owner: Andy Halliday", f"unexpected owner line: {owner_text!r}"

    # Replace v1_p with v1.1 line.
    new_version = make_paragraph(
        make_run("Version 1.1  ·  May 2026", bold=False),
        spacing_after="60",
    )
    parent[idx] = new_version

    # Replace status_p with revised status line.
    new_status = make_paragraph(
        make_run("Status: Draft for Review (revised)", bold=False),
        spacing_after="60",
    )
    parent[idx + 1] = new_status

    # Insert v1.1 revision note paragraph after Owner.
    revnote = body_italic(
        "v1.1 (2026-05-31) replaces §3, the §4 feature table, "
        "§5 Journey 1, the §6.3 review_queue spec, and §9 to "
        "incorporate the navigation-surfaces reframing captured in "
        "documentation/feature_navigation_surfaces.md."
    )
    parent.insert(idx + 3, revnote)


# -------------------------------------------------------------------
# New section content (the actual v1.1 text)
# -------------------------------------------------------------------

def section_3_phase_0() -> list[etree._Element]:
    """Content under the §3 heading (heading itself replaced by main())."""
    out = []
    out.append(h2("3.1 Design Rationale"))
    out.append(body(
        "Phase 0 is the user’s first hours with Life Chronicle. The goal "
        "is not to extract a complete ontology before memory collection begins. "
        "The goal is to make the user fluent in the three navigation surfaces "
        "— Globe, Recollections, Timelines — by giving each surface "
        "enough data to render meaningfully, so the user feels they are "
        "constructing something real from the first interaction."
    ))
    out.append(body(
        "The original v1 framing (three sequential interview stages with a "
        "validation gate before memory collection began) was retired on "
        "2026-05-30. Two assumptions in that framing did not survive design "
        "contact: that synthesis artifacts and navigation views are the same "
        "thing (they are not — the Globe is a surface from the first pin; "
        "portrait prose enriches but does not gate it), and that the target "
        "user wants a guided sequence with completion gates (they don’t "
        "— stage gates compete with the engagement we are trying to "
        "create). Strands run in parallel under the hood (per memory/"
        "project_lc_ontology_bootstrap.md); navigation surfaces are introduced "
        "organically when the data supports them."
    ))
    out.append(body(
        "The canonical spec for the surfaces is "
        "documentation/feature_navigation_surfaces.md."
    ))

    out.append(h2("3.2 The Three Surfaces and Their Introduction"))
    out.append(body(
        "The three navigation surfaces — Globe, Recollections, Timelines "
        "— are present in the top nav from the user’s first sign-in. "
        "They are not gated; the user can click any of them at any time. What "
        "changes over the course of Phase 0 is the onboarding agent’s "
        "invitation to visit each surface — drawn from the agent’s "
        "read of chronicle state."
    ))
    out.append(body(
        "The user’s first signed-in screen is the Globe with the welcome "
        "prompt “Where were you born?” (per "
        "feature_residential_globe_onboarding.md). The user places pins and "
        "writes or dictates per-pin context. Each pin is a residency memory "
        "plus a lived_at relationship plus a place entity. The Globe is "
        "meaningful from the first pin."
    ))
    out.append(body(
        "After the first pin or first capture-assistant submission (whichever "
        "comes first), the onboarding agent draws the user’s attention to "
        "the Recollections tab: “Here’s what you’ve shared so "
        "far — searchable any time.” The user clicks through and sees "
        "their captures as a chronological card list. They learn that the "
        "chronicle has a chronological face, not just a geographic one. (The "
        "Recollections tab was present before this moment; the agent’s "
        "invitation is what changes.)"
    ))
    out.append(body(
        "After the user has confirmed three person entities through the entity "
        "verification UI, the onboarding agent draws the user to the Timelines "
        "tab with the Life’s Cast / Significant Relationships dimension "
        "pre-loaded: “You’ve named a few significant people — "
        "take a look at how the start of your life’s relationship arc is "
        "shaping up.” The user sees the swimlane render — three or "
        "four bars on a life-span axis. The visceral sense of “here’s "
        "the shape of my life starting to render” motivates continued "
        "capture."
    ))
    out.append(body(
        "The lead Timelines dimension at MVP is Life’s Cast — the "
        "user-facing branding of what is, technically, the Significant "
        "Relationships dimension. Casual acquaintances and professional "
        "contacts remain visible in Recollections as entity chips on memory "
        "cards but do not populate this dimension at MVP."
    ))

    out.append(h2("3.3 No Completion Gate"))
    out.append(body(
        "There is no “Phase 0 complete” event. The user never presses "
        "a “done” button. The system’s internal state tracks "
        "data accumulation across three strands (residential, entity, topic); "
        "when thresholds are met, synthesis artifacts generate in the "
        "background and enrich the existing surfaces. Surfaces start sparse "
        "and get richer as the user continues to capture."
    ))

    out.append(h2("3.4 Threshold-Triggered Agent Invitations (Not Surface Gating)"))
    out.append(body(
        "The three primary navigation surfaces — Globe, Recollections, "
        "Timelines — are always accessible in the top nav. No threshold "
        "ever removes a surface from the nav, and no threshold gates "
        "user-initiated navigation to a surface. The user can click any "
        "surface at any time, including before any data exists for it (in "
        "which case the surface shows its empty state with a directional "
        "invitation to capture, per the open-question resolution in "
        "feature_navigation_surfaces.md §10 OQ-NS-2)."
    ))
    out.append(body(
        "The Planner Agent monitors chronicle state across the three strands "
        "(residential, entity, topic) and is responsible only for triggering "
        "the capture assistant’s invitations to visit each surface — "
        "the warm, contextual prompts that draw the user to a tab they may not "
        "have noticed yet. Threshold examples: first pin placed → invite "
        "to Recollections; three person entities confirmed → invite to "
        "Timelines / Life’s Cast. The thresholds tune the timing of the "
        "agent’s prompts, nothing more."
    ))
    out.append(body(
        "The interview_sessions table records session_type values for each "
        "user-facing interaction (capture_inline, residential_pin, "
        "entity_confirmation, etc.), allowing the Planner Agent to query "
        "strand-by-strand progress without relying on application-layer state."
    ))

    out.append(h2("3.5 The Residential Spine"))
    out.append(body(
        "Within the residential strand, the Globe is the highest-priority "
        "elicitation surface during onboarding. A person’s sequence of "
        "homes provides bilateral temporal constraints at every move — "
        "each confirmed move date simultaneously closes the previous period "
        "and opens the next. The residential chain is the structural backbone "
        "the Temporal Agent builds on first, before any other temporal "
        "resolution work."
    ))
    out.append(body(
        "The Globe onboarding flow (per "
        "feature_residential_globe_onboarding.md) is structured around what "
        "people remember easily: the place itself, who was there, why the "
        "move happened, and what was happening in life at the time. Dates are "
        "asked last and framed relationally (“was this before or "
        "after…”) rather than directly (“what year…”)."
    ))
    return out


def section_4_2_feature_table() -> list[etree._Element]:
    """Replaces the original §4.2 table. Renders as labeled paragraphs
    per domain rather than the old MVP/Phase2/Notes table, since the new
    format is more list-like. Heading kept by main()."""
    out = []
    out.append(body_italic(
        "v1.1 format: MVP scope per domain, then Phase 2 additions per "
        "domain. Items that ship in MVP are not redundantly marked as "
        "“also in Phase 2”; Phase 2 entries are strictly "
        "incremental over MVP."
    ))

    def domain(name: str, mvp: str, phase2: str):
        out.append(h3(name))
        out.append(labeled_para("MVP", mvp))
        out.append(labeled_para("Phase 2 adds", phase2))

    domain(
        "CAPTURE",
        "text (web), voice (web/mobile via MediaRecorder), SMS async "
        "(deeplink-back)",
        "voice-only phone (inbound call, accessibility channel), video "
        "capture modality, video archive processing (atomization; facial "
        "recognition deferred)",
    )

    domain(
        "ORGANISATION",
        "three-surfaces familiarisation (replaces the original Phase 0 "
        "three-stage bootstrap — see §3 and "
        "feature_navigation_surfaces.md), 10-dimension Tagger Agent "
        "(single-pass), Entity graph (Entity Agent proposes, user confirms "
        "via /review)",
        "user-defined chapter naming via user_periods (emerges from data, "
        "not pre-elicited), user-defined custom taxonomy nodes (schema ready; "
        "UI Phase 2), Temporal Agent + constraint propagation (raw envelope "
        "in MVP; agent is Phase 2)",
    )

    domain(
        "NAV SURFACES (new in v1.1)",
        "Globe surface (Mapbox GL JS 2D/2.5D pins + transit animation + "
        "click-to-memories), Recollections surface (sort + filter chips + "
        "entity chips + draft badge + cross-surface deep links), Timelines "
        "surface (Life’s Cast / Significant Relationships dimension; "
        "swimlane render; dimension selector on page), navigation chrome "
        "(top tabs + slim left rail + capture FAB per "
        "feature_navigation_surfaces.md §11)",
        "Globe Cesium 3D + satellite memory prompts + video pin attachments; "
        "Recollections full-text + semantic search + saved searches + chapter "
        "grouping; Timelines Career / Education / Themes dimensions + "
        "cross-surface “where they appear” Globe highlight",
    )

    domain(
        "SYNTHESIS",
        "Assumption log (silent background write — Tagger and Entity "
        "agents write traces; surfaces are not user-visible at MVP)",
        "Assumption log UI (user-visible review of agent reasoning); "
        "entity_biography for places (enriches Globe pin click with prose "
        "portrait); lifes_cast for Life’s Cast / Significant "
        "Relationships (enriches Timelines entries with prose summary per "
        "entity); Chapter Narrative (life_period_narrative, requires richer "
        "collection); Relationship Portrait (relationship_portrait, deep "
        "single-relationship synthesis); Wisdom Distillation (requires The "
        "Stroll reflections); The Stroll reminiscence mode (launched from "
        "within Recollections or Timelines, not a fourth nav surface)",
    )

    domain(
        "PRIVACY & SHARING",
        "Access Cards (5 system cards, full schema day one — see "
        "access_cards_requirements.md), Single Post Share (token URL, no "
        "login required, owner can expire or revoke)",
        "Custom Share Cards (user-defined, rule-builder UI + preview), "
        "Social media share + comment capture (memory_shares + "
        "share_comments tables), Contribution access (card holders add to "
        "chronicle — schema columns in MVP, UI Phase 2), Executor card "
        "(posthumous access, card with posthumous-trigger validity), "
        "Training consent UI (data model ready; messaging held until Phase "
        "2–3)",
    )

    domain(
        "EXPORT",
        "Basic JSON export",
        "CEF v1 structured export (ZIP with manifest, full spec in "
        "cef-schema.json)",
    )

    return out


def section_5_journey_1() -> list[etree._Element]:
    """Heading renamed by main()."""
    out = []
    out.append(body(
        "User signs in for the first time. The first screen is the Globe "
        "with the welcome prompt “Where were you born?”"
    ))
    for txt in [
        "User pans, zooms, and clicks. A pin appears. The modal opens for "
        "per-pin context (free-text, optional date, residence type). The "
        "Entity Agent creates a place entity for the pin with geocoordinates "
        "resolved via Mapbox Geocoding API. A residency memory is written; a "
        "lived_at relationship is created with dates entered as temporal "
        "constraints.",

        "After the first pin (and a small synthetic delay to let the user "
        "see the pin land), the onboarding agent draws the user’s "
        "attention to the Recollections tab in the top nav. The user notices "
        "it and may click in; the surface shows the residency memory as a "
        "card. The user learns the chronicle has a chronological face.",

        "The user continues placing pins or shifts to the capture FAB to "
        "dictate a separate memory. Both flows write to the same Raw Vault; "
        "both surface in Recollections.",

        "As the user mentions or directly enters significant people in their "
        "captures, the Entity Agent extracts them. New person entities "
        "surface as confirmation cards in the /review queue. The user "
        "confirms each (or renames, merges, rejects) via the /review UI.",

        "Once the user has confirmed three person entities, the onboarding "
        "agent draws the user to the Timelines tab with a warm prompt about "
        "the Life’s Cast / Significant Relationships arc. The user sees "
        "the swimlane render — three short bars on a life-span axis. "
        "The user is invited to add more people they cared about, with the "
        "visual feedback of new bars appearing on the swimlane.",

        "No completion banner, no stage celebration. The user simply has "
        "access to three navigation surfaces — Globe, Recollections, "
        "Timelines — each rendering whatever data exists, each inviting "
        "the user to add more.",

        "Synthesis artifacts (entity_biography for places, lifes_cast for "
        "the Life’s Cast / Significant Relationships dimension) "
        "generate in the background as data accumulates past Phase 2 "
        "thresholds. The surfaces remain functional throughout; synthesis "
        "enriches them.",
    ]:
        out.append(bullet(txt))
    return out


def section_6_3_review_queue() -> list[etree._Element]:
    """Heading kept by main()."""
    out = []
    out.append(body(
        "Holds all items requiring user attention: proposed entity merges, "
        "agent-inferred temporal constraints awaiting confirmation, "
        "sensitive-promotion requests, synthesis stale notifications, and "
        "(Phase 2) contribution reviews. New person entities surface here "
        "too (entity_confirmation_needed item_type)."
    ))
    rows = [
        ["Column", "Type", "Description"],
        ["id", "UUID PK", ""],
        ["user_id", "UUID", "Chronicle owner"],
        ["item_type", "TEXT", "entity_merge_proposal | entity_confirmation_needed | temporal_constraint | sensitive_promotion | synthesis_stale | contribution_review | assumption_review | memory_elaboration_needed"],
        ["item_id", "UUID", "FK to the item being reviewed (polymorphic)"],
        ["context_json", "JSONB", "Per-type metadata (extraction quote, proposed primary, etc.)"],
        ["priority", "SMALLINT", "1 (urgent) – 5 (low); drives sort order"],
        ["surfaced_at", "TIMESTAMPTZ", "When added to the queue"],
        ["resolved_at", "TIMESTAMPTZ", "NULL until resolved"],
        ["resolution", "TEXT", "confirmed | renamed | rejected | merged | deferred | dismissed"],
        ["resolution_payload", "JSONB", "Action-specific structured data: {merged_into_id} for merged, {canonical_name, aliases} for renamed, {resurface_at} for deferred. Empty object for confirmed/rejected/dismissed."],
        ["resolution_note", "TEXT", "Optional free-text user note"],
        ["resolved_by", "TEXT", "Channel that resolved the item: user (UI click) | system (auto cleanup) | agent:<name> (agent auto-resolution)"],
        ["created_at", "TIMESTAMPTZ", ""],
    ]
    tbl, spacer = make_table(rows, col_widths=[1600, 1600, 6160])
    out.append(tbl)
    out.append(spacer)
    return out


def section_9_synthesis() -> list[etree._Element]:
    """Heading kept by main()."""
    out = []
    out.append(h2("9.1 Scope Note"))
    out.append(body(
        "Per the navigation-surfaces reframing (§3 + "
        "documentation/feature_navigation_surfaces.md), the MVP ships three "
        "navigation surfaces — Globe, Recollections, Timelines — "
        "each of which functions without synthesis. Synthesis artifacts are "
        "not standalone MVP deliverables; they are Phase 2 enrichments to the "
        "surfaces. This section describes how the synthesis types fit each "
        "surface."
    ))

    out.append(h2("9.2 Surface enrichment: the Globe"))
    out.append(labeled_para("Synthesis type", "entity_biography for place entities (Phase 2)."))
    out.append(labeled_para("Where it appears", "as prose attached to each pin’s detail panel."))
    out.append(labeled_para(
        "Surface behaviour without synthesis",
        "pin click opens the memories anchored to that place (the "
        "Recollections cross-surface deep link)."
    ))
    out.append(labeled_para(
        "Surface behaviour with synthesis",
        "pin click also surfaces the entity_biography portrait — “the "
        "period the user spent there” — as prose above the memory "
        "list."
    ))
    out.append(labeled_para(
        "Globe visualisation library",
        "Mapbox GL JS (2D/2.5D at MVP; Cesium 3D deferred)."
    ))

    out.append(h2("9.3 Surface enrichment: Life’s Cast (Significant Relationships)"))
    out.append(labeled_para("Internal synthesis type", "lifes_cast (Phase 2)."))
    out.append(labeled_para("User-facing name (branding)", "Life’s Cast."))
    out.append(labeled_para(
        "Technical descriptor (subtext)",
        "the Significant Relationships dimension of the Timelines surface."
    ))
    out.append(body(
        "The name “Life’s Cast” is preserved from the original "
        "v1 §9 framing and from the Shakespeare resonance (“all the "
        "world’s a stage, and all the men and women merely players; they "
        "have their exits and their entrances”). It carries the emotional "
        "register the chronicle reaches for. The technical name "
        "“Significant Relationships” carries the scoping precision "
        "— this dimension covers the people who occupied the central "
        "emotional roles (partners, deepest friendships, lifelong family "
        "figures), not casual acquaintances or professional contacts. Both "
        "names point at the same data; the user sees “Life’s "
        "Cast” in the UI, and the technical literature (this PRD, the "
        "feature spec, schema comments) uses both."
    ))
    out.append(labeled_para(
        "Where it appears",
        "as the prose body of each entity entry in the swimlane, when the "
        "user expands an entry."
    ))
    out.append(labeled_para(
        "Surface behaviour without synthesis",
        "the entry shows entity name, period of significance, memory count, "
        "and the first-line excerpt from the most recent memory. The "
        "swimlane bar itself is unaffected by synthesis presence — it "
        "renders from the entity and memory data alone."
    ))
    out.append(labeled_para(
        "Surface behaviour with synthesis",
        "the expanded entry includes the lifes_cast prose summary of the "
        "person’s role across the life stages they were active. Memory "
        "IDs that supported the entry are linkable to Recollections."
    ))
    out.append(labeled_para(
        "Visualisation pattern (canonical)",
        "swimlane / Gantt-style layout, one horizontal bar per entity, "
        "x-axis = life span (birth → present), bar length = period of "
        "significance, bar opacity or tick-marks = memory density. Lifelong "
        "presences span the full axis; short blooms are visually obvious. "
        "See feature_navigation_surfaces.md §5.2a for the persistence "
        "rationale."
    ))

    out.append(h2("9.4 Synthesis as Phase 2 work"))
    out.append(body(
        "The MVP does not block on synthesis. Both entity_biography and "
        "lifes_cast are scheduled for Step 11 (post-MVP). The MVP launch "
        "ships the three surfaces functional and unenriched; Step 11 "
        "enriches them."
    ))
    out.append(body(
        "The other synthesis types in the original PRD v1 (Chapter "
        "Narrative, Relationship Portrait, Wisdom Distillation) remain Phase "
        "2 per §4. None block on MVP work."
    ))
    return out


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

def main(unpacked_dir: str) -> None:
    doc_path = Path(unpacked_dir) / "word" / "document.xml"
    tree = etree.parse(str(doc_path))
    root = tree.getroot()
    body_el = root.find(W + "body")

    # ----- 1. Version line bump -----
    replace_version_line(body_el)

    # ----- 2. §3 Phase 0 full rewrite (heading text changes) -----
    replace_section(body_el,
                    "3. Phase 0 — Multi-Session Onboarding",
                    "4. Feature Scope",
                    section_3_phase_0(),
                    new_heading_text="3. Phase 0 — Onboarding via the Three Navigation Surfaces")

    # ----- 3. §4.2 Feature Phase Table (heading kept) -----
    replace_section(body_el,
                    "4.2 Feature Phase Table",
                    "5. Core User Journeys",
                    section_4_2_feature_table())

    # ----- 4. §5 Journey 1 (heading text changes) -----
    replace_section(body_el,
                    "Journey 1: Phase 0 Onboarding",
                    "Journey 2: Ongoing Memory Capture (SMS)",
                    section_5_journey_1(),
                    new_heading_text="Journey 1: Onboarding via the Three Surfaces")

    # ----- 5. §6.3 review_queue spec (heading kept) -----
    replace_section(body_el,
                    "review_queue — Unified user touch point",
                    "memory_shares — Share event log + Single Post Share tokens",
                    section_6_3_review_queue())

    # ----- 6. §9 Synthesis Artifacts (heading kept) -----
    replace_section(body_el,
                    "9. MVP Synthesis Artifacts",
                    "10. Non-Functional Requirements",
                    section_9_synthesis())

    # Write back.
    tree.write(str(doc_path), xml_declaration=True, encoding="UTF-8", standalone=True)
    print(f"wrote {doc_path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/prd_unpacked")
