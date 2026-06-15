/**
 * Client-side pin-image preprocessing (Step 7 Slice 2 follow-up,
 * agreed 2026-06-10):
 *
 *   1. HEIC/HEIF → JPEG. iPhone photos upload fine but only Safari can
 *      render HEIC in an <img>; converting before upload makes them
 *      first-class in every browser. Decoder (heic2any, wasm) loads
 *      lazily — only when a HEIC actually arrives.
 *   2. Compression toward the ~2MB target from the image-storage memo:
 *      downscale to max 2048px and re-encode as JPEG, stepping quality
 *      down until under target (or the quality floor).
 *
 * Browser-only (canvas APIs) — call from client components.
 */

const TARGET_BYTES = 2 * 1024 * 1024
const MAX_DIMENSION = 2048
const QUALITY_START = 0.85
const QUALITY_FLOOR = 0.6
const QUALITY_STEP = 0.07

const HEIC_RE = /\.hei[cf]$/i

function isHeic(file: File): boolean {
  return /^image\/hei[cf]$/.test(file.type) || HEIC_RE.test(file.name)
}

function jpegName(name: string): string {
  return name.replace(/\.[^.]+$/, '') + '.jpg'
}

async function encodeJpeg(source: ImageBitmap, scale: number, quality: number): Promise<Blob> {
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(source, 0, 0, w, h)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
      'image/jpeg',
      quality,
    )
  })
}

export interface PreprocessResult {
  /** The file to upload (converted/compressed JPEG, or the original). */
  file: File
  /** Non-null when conversion/compression was skipped — a soft notice for
   *  the user; the upload still succeeds with the original file. */
  warning: string | null
}

/**
 * Best-effort preprocessing. Returns the file to upload and an optional
 * warning. Conversion and compression are ENHANCEMENTS — if either
 * fails, the original file uploads anyway (the bucket accepts HEIC), so a
 * decoder hiccup never blocks the user's photo (regression fixed
 * 2026-06-14: a heic2any rejection used to fail the whole upload).
 */
export async function preprocessPinImage(file: File): Promise<PreprocessResult> {
  let working: Blob = file
  let name = file.name
  const heic = isHeic(file)

  if (heic) {
    try {
      const mod = await import('heic2any')
      const convert = (mod.default ?? mod) as (opts: {
        blob: Blob; toType?: string; quality?: number
      }) => Promise<Blob | Blob[]>
      const out = await convert({ blob: file, toType: 'image/jpeg', quality: QUALITY_START })
      working = Array.isArray(out) ? out[0] : out
      name = jpegName(name)
    } catch (err) {
      // heic2any rejects with a plain object, not an Error — stringify it
      // so the diagnostic is actually readable.
      console.error(
        '[pin-image] HEIC→JPEG conversion failed; uploading the original HEIC.',
        err instanceof Error ? err : JSON.stringify(err),
      )
      return {
        file,
        warning:
          'Couldn’t convert this HEIC photo — it was uploaded as-is and may only display in Safari.',
      }
    }
  }

  // Animated GIFs would lose animation through canvas; pass through.
  if (!heic && file.type === 'image/gif') return { file, warning: null }

  // Fast paths: already small enough.
  if (working.size <= TARGET_BYTES) {
    if (!heic) return { file, warning: null }
    return { file: new File([working], name, { type: 'image/jpeg' }), warning: null }
  }

  // Downscale + re-encode, stepping quality down toward the target. Also
  // best-effort: a canvas/decode failure falls back to the (converted or
  // original) working blob rather than failing the upload.
  try {
    const bitmap = await createImageBitmap(working)
    try {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
      let best: Blob | null = null
      for (let q = QUALITY_START; q >= QUALITY_FLOOR - 1e-9; q -= QUALITY_STEP) {
        best = await encodeJpeg(bitmap, scale, q)
        if (best.size <= TARGET_BYTES) break
      }
      if (!best) throw new Error('JPEG encode produced nothing')
      return { file: new File([best], jpegName(name), { type: 'image/jpeg' }), warning: null }
    } finally {
      bitmap.close()
    }
  } catch (err) {
    console.warn('[pin-image] compression skipped (decode/encode failed).', err)
    const fallback = heic
      ? new File([working], name, { type: 'image/jpeg' })
      : file
    return { file: fallback, warning: null }
  }
}
