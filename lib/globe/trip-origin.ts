/**
 * Trip-origin suggestion precedence (2026-07-19).
 *
 * "Start a trip from here" (Andy's request, from the Mt. Snow Chalet
 * question) arms an origin-first entry into the destination-first trip
 * flow: the armed pin becomes the suggested origin wherever the framing
 * panel next opens. Precedence:
 *
 *   existing origin  — a trip that already has one keeps it
 *   > armed origin   — the "from here" pin the user explicitly chose
 *   > anchor         — the destination pin's anchor residence
 *   > Home Base      — the frequent-traveler default (KTD8)
 *   > null           — framing panel offers "decide later"
 */

export function suggestTripOrigin(opts: {
  existingOriginId?: string | null
  armedOriginId?: string | null
  anchorId?: string | null
  homeBaseId?: string | null
}): string | null {
  return opts.existingOriginId ?? opts.armedOriginId ?? opts.anchorId ?? opts.homeBaseId ?? null
}
