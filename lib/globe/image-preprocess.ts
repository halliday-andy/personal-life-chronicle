/**
 * Client-side pin-image preprocessing (Step 7 Slice 2 follow-up).
 *
 * Scope as of 2026-06-14: **compression only**. HEIC→JPEG conversion was
 * moved SERVER-SIDE (lib/globe/heic-server.ts) — doing it in the browser
 * (heic2any/libheif) was unreliable and failed on real iPhone files. HEIC
 * now passes straight through to the server, which converts it. Here we
 * only downscale/re-encode large raster images to save bandwidth.
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
  // HEIC/HEIF: don't touch it in the browser — the server converts it to
  // JPEG reliably. Canvas can't decode HEIC anyway. Pass straight through.
  if (isHeic(file)) return { file, warning: null }

  // Animated GIFs would lose animation through canvas; pass through.
  if (file.type === 'image/gif') return { file, warning: null }

  // Already small enough — nothing to gain from re-encoding.
  if (file.size <= TARGET_BYTES) return { file, warning: null }

  // Downscale + re-encode large raster images to save bandwidth. Best-
  // effort: a canvas/decode failure falls back to the original file rather
  // than failing the upload.
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
      let best: Blob | null = null
      for (let q = QUALITY_START; q >= QUALITY_FLOOR - 1e-9; q -= QUALITY_STEP) {
        best = await encodeJpeg(bitmap, scale, q)
        if (best.size <= TARGET_BYTES) break
      }
      if (!best) throw new Error('JPEG encode produced nothing')
      return { file: new File([best], jpegName(file.name), { type: 'image/jpeg' }), warning: null }
    } finally {
      bitmap.close()
    }
  } catch (err) {
    console.warn('[pin-image] compression skipped (decode/encode failed).', err)
    return { file, warning: null }
  }
}
