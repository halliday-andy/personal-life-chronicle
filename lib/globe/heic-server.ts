/**
 * Server-side HEIC/HEIF → JPEG conversion (2026-06-14).
 *
 * SERVER ONLY — uses heic-convert (libheif via WASM) in the Node runtime.
 * Browsers vary wildly in their ability to decode HEIC (heic2any was
 * flaky and failed on real iPhone files), so conversion happens here, in
 * one controlled environment: storage then always holds a web-universal
 * JPEG that renders in Chrome, Firefox, and Safari alike.
 *
 * Non-HEIC input passes through untouched.
 */

const HEIC_RE = /\.hei[cf]$/i
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024

function isHeic(mimeType: string, filename: string | null): boolean {
  return /^image\/hei[cf]$/i.test(mimeType) || (!!filename && HEIC_RE.test(filename))
}

function jpegName(name: string | null): string | null {
  return name ? name.replace(/\.[^.]+$/, '') + '.jpg' : name
}

export interface WebSafeImage {
  bytes: Buffer
  mimeType: string
  filename: string | null
  converted: boolean
}

/**
 * Returns a web-universal image. HEIC/HEIF is decoded and re-encoded as
 * JPEG (quality stepped down if the result would exceed the storage cap —
 * HEIC is more space-efficient, so a converted JPEG can be larger than the
 * source). Anything else is returned unchanged. Throws only if a HEIC
 * genuinely can't be decoded (corrupt/unsupported); the caller maps that
 * to a 422.
 */
export async function toWebSafeImage(
  bytes: Buffer,
  mimeType: string,
  filename: string | null,
): Promise<WebSafeImage> {
  if (!isHeic(mimeType, filename)) {
    return { bytes, mimeType, filename, converted: false }
  }

  // Lazy-load so the WASM decoder is only paid for when a HEIC arrives.
  const mod = await import('heic-convert')
  const convert = (mod.default ?? mod) as (opts: {
    buffer: Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number
  }) => Promise<ArrayBuffer | Uint8Array>

  let last: Buffer | null = null
  for (const quality of [0.85, 0.6, 0.45]) {
    const out = await convert({ buffer: bytes, format: 'JPEG', quality })
    last = Buffer.from(out as Uint8Array)
    if (last.byteLength <= MAX_OUTPUT_BYTES) break
  }
  if (!last) throw new Error('HEIC conversion produced no output')
  return { bytes: last, mimeType: 'image/jpeg', filename: jpegName(filename), converted: true }
}
