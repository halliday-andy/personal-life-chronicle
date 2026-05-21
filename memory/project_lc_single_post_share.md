---
name: Project: LC Single Post Share — design rationale and alpha hypothesis
description: Single Post Share was pulled to MVP to test collaborative memory enrichment — sharing a recollection with someone who was present and capturing their additive response. The shared view must actively invite response, not just display content.
type: project
---

## Why Single Post Share is in MVP

The primary motivation is not convenience sharing. It's a specific alpha test hypothesis:

**Hypothesis:** Sharing a recollection with someone who was present at the event will elicit additive perspective — new detail, confirmations, or a different version — that enriches the original memory record.

Andy (primary alpha user) wants to send a specific memory to someone involved in that event and see what they add. The test is whether the feature actually generates useful additive responses, and whether those responses are worth routing into the memory revision workflow.

**Why:** This is a meaningful capability that no existing tool offers at this ease-of-use level. If it works, it becomes a core social mechanic of the product — memories becoming more accurate and complete through the people who shared them.

## Design implications for the shared view (/share/{token})

The shared view must not be a passive display page. The UX goal is to elicit a response from someone who was there. Design requirements for Step 12 implementation:

1. **Active response invitation** — the page should lead with an invitation, not just the memory content. Something like: "Andy shared a memory of this event and would love your perspective on it." The response field should be prominent — above the fold or immediately after the memory text.

2. **Framing toward the additive** — prompt text should nudge toward additive responses: "What do you remember from this?" or "Was anything missing?" rather than generic "Leave a comment." The prompt encourages enrichment over reaction.

3. **Low-friction response capture** — no login, no registration. Name and email optional. Just a response field and a send button.

4. **Confirmation on submit** — after submitting, recipient sees: "Your response has been sent to Andy." No more interaction required.

## How responses flow back

Recipient responses (share_comments table) should route to the review_queue as contribution_review items. The owner sees them in the Review Inbox and decides whether to:
- Incorporate into a memory_revision (factual_correction, context_update, etc.)
- Note as a confirmed detail (future Phase 2 feature)
- Archive as a comment without promoting it to the revision layer

This is the same contribution review workflow from Access Cards, but for non-registered, anonymous contributors arriving via share token.

## How to apply

When implementing Step 12 (Single Post Share, documentation/LC_Development_Sequence.md):
- The /share/{token} page is not a passive viewer — it is an enrichment invitation
- Every share_comments.comment_text INSERT from this page should also INSERT a review_queue row with item_type = 'contribution_review', priority = 2
- The Review Inbox (Step 15) must surface these items clearly, distinguishing them from agent-generated review items
- Step 12 acceptance criteria should include: submitting a response via the shared view creates a review_queue row visible in the owner's inbox

## Connection to The Stroll

Pathway C of The Stroll (memory revision) and Single Post Share serve adjacent purposes — both can generate memory_revisions. The difference: The Stroll is the owner revising their own memory; Single Post Share brings in another person's perspective. Both feed the same revision layer. In a future version, a promoted share_comment could be formally converted to a memory_revision with revision_source = 'external_contributor'.
