import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()

    // Lightweight connectivity check — no table needed
    const { error } = await supabase.rpc('now' as never)

    if (error && error.code !== 'PGRST202') {
      // PGRST202 = function not found, which still proves DB connectivity
      throw error
    }

    return NextResponse.json({ status: 'ok', db: true })
  } catch {
    return NextResponse.json(
      { status: 'error', db: false },
      { status: 503 }
    )
  }
}
