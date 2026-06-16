# QA Walkthrough — recent UI & features (2026-06-15)

Hands-on checklist to experience everything modified recently, before the next slice.
App: **http://localhost:3001** (sign in first). Suggested order top-to-bottom.

> Tip: try the photo steps in **Chrome** specifically — HEIC display in Chrome was the whole point of the recent fix.

---

## 1. Global navigation (new shared AppNav)
- [ ] On any admin page (Dashboard/Memories/Entities/Review/Interview) a single top bar shows **Life Chronicle** + links: Dashboard · Globe · Memories · Entities · Review · Interview, with your email + **Sign out** on the right.
- [ ] The **current page is highlighted** (darker/bolder) in the bar.
- [ ] Click through every link — each page loads, no dead ends, no doubled-up headers.
- [ ] Open **/globe** — the top bar is **absent** (globe is full-screen) and instead a glass **← Dashboard** link sits top-right. Click it → back to Dashboard.
- [ ] Dashboard shows a dark **Life Globe** card with your residence count; click it → globe.

## 2. Globe — the visual language (place types, tethers, legend)
- [ ] Bottom-left **Legend** (collapsible) keys 6 pin types + 3 line tiers. Expand it.
- [ ] The **primary-residence spine** is a solid glowing **chevron** arc connecting your homes in order; chevrons point earliest → latest.
- [ ] Select a spine pin → its **inbound leg brightens** more than its outbound leg (approached-from vs. egressed-to).
- [ ] Confirm pin colors differ by type per the legend (primary = bright ember; workplace = cyan; second residence = double-ring ember; short-term = dim dot; vacation = rose; professional travel = slate).

## 3. Globe — place a pin of each type
For each, use search box → drag the pin → **Add this place** → pick the **type** (read the one-line description under the selector) → pick the **anchor** ("which home were you living in then?" / Workplace: "which home did you commute from?").
- [ ] **Primary residence** — appears on the spine; asks "where does this fall in your life?" (sequence), not an anchor.
- [ ] **Workplace** — anchored to a home → draws a **solid cyan commute line** to that home.
- [ ] **Vacation** — anchored → **dashed** tether to its home. (Playa Comaruga already exists as a Short-term stay → Zaragoza.)
- [ ] **Second residence / Short-term stay / Professional travel** — each draws a dashed tether to its chosen home.
- [ ] Choose **"Not sure / standalone"** for a marker → it places with **no tether**.

## 4. Globe — edit, re-type, reorder
- [ ] Click a pin → **detail card** shows a **colored type chip + label**, the *when* phrase, the recollection (scrollable), any **fact chips**, and a photo area.
- [ ] Click **Edit** → the right panel has a **Type** dropdown (with description) and, for markers, an **anchor** selector.
- [ ] **Re-type a vacation → Primary residence** → it joins the spine (gets sequence position, gains the glow). Re-type it **back** → returns to a dashed marker.
- [ ] **Re-type a Primary that has markers anchored to it → Second residence** → those markers' **tethers disappear** (they orphan to standalone). *(This is the anchor-safety fix.)*
- [ ] On a **primary** pin only, the panel shows **↑ Earlier / ↓ Later** reorder; markers don't.
- [ ] Drag a selected pin to relocate; **Save** → it stays; you land back on the refreshed detail card with a "Saved" toast.

## 5. Photos (HEIC + multi-photo gallery) — do this in Chrome
- [ ] On a pin detail card, **Add a photo** using a **.HEIC** file from your iPhone → it uploads **and displays** (no broken image, no "Photo action failed"). *(Server now converts HEIC→JPEG.)*
- [ ] Open **Edit** → the gallery: **+ Add photo** several times; each appears.
- [ ] Hover a non-primary thumbnail → **★ primary** to promote it; the card's main photo updates.
- [ ] Hover → **✕ remove** one; it disappears, and if you removed the primary another is promoted.
- [ ] Back on the detail card, a **+N badge** shows on the photo when the gallery has more than one.

## 6. Recollections & Review
- [ ] **/memories** lists your recollections in full text (Lockbourne shows the long aviation-story memory).
- [ ] On a **finalized** memory, a subtle **Delete** (top-right) needs **two clicks** ("click again — permanent") before it removes. *(Don't delete anything you want to keep.)*
- [ ] Back on the globe, open the **Lockbourne** detail card → **"More recollections here"** lists the aviation story; click it to **expand the full text**; **"View all in Recollections →"** opens /memories filtered to that place.
- [ ] **/review** — the backlog card for your **Zaragoza / Operation Reflex** research now shows the **full research text** (scrollable) + "Queued because…", with a **Dismiss** action.

## 7. Round-trip navigation
- [ ] Globe pin → (Recollections link) → /memories → AppNav → Entities → Review → Dashboard → Globe. Confirm you can always get everywhere.

---

## Known/by-design — NOT bugs (skip or just note)
- **RAF Mildenhall** shows **no fact chips** — its AI extraction never ran (Inngest was down at save time). I can re-trigger it on request.
- The **/review backlog card is Dismiss-only** — a real workflow for research (attach-to-entity) is the *next* design (context layer), not built yet.
- **/memories has no entity chips / "add context" yet**, and isn't searchable yet — both are in the upcoming context-layer slice.
- **Era coloration / proportional timeline** on the globe is deferred to the Temporal Agent.
- A **HEIC in a non-Chrome/Safari browser** edge case isn't relevant now — server conversion makes stored images universal JPEG.

## If you find something off
Jot the page, the steps, and what you expected vs. saw. I'll triage — especially anything in sections 3–5 (the newest code).
