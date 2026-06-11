import { inngest } from '@/lib/inngest/client'

/**
 * Send an Inngest event without letting a slow/down event server stall
 * the caller. A dead Inngest dev server made `await inngest.send` burn
 * ~6s in connect timeouts inside a save request (2026-06-10), so this
 * races the send against a short deadline and never throws.
 *
 * The send itself isn't cancelled on timeout — if the server responds
 * late, the event is still delivered. Returns true if the send
 * confirmed within the deadline (callers may log, not branch, on it).
 */
export async function sendEventQuick(
  event: Parameters<typeof inngest.send>[0],
  timeoutMs = 1500,
): Promise<boolean> {
  try {
    const confirmed = await Promise.race([
      inngest.send(event).then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ])
    if (!confirmed) {
      console.warn('[inngest] send not confirmed within deadline (event may still arrive)', { timeoutMs })
    }
    return confirmed
  } catch (err) {
    console.warn('[inngest] send failed', err)
    return false
  }
}
