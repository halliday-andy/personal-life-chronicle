/**
 * Orchestrator submission endpoint.
 *
 * Authenticates with the user-scoped Supabase client (server.ts), then
 * delegates to runOrchestrator which uses the admin client internally
 * for all writes. Mirrors the hardened error pattern from
 * /api/interview/message (stage markers + dev-mode error surfacing +
 * try/catch wrapper) so failures are diagnosable.
 *
 * Returns OrchestratorResponse: { reply, proposals, meta } with
 * meta.submission_id (capture_submissions row), digest_hash,
 * iterations, model, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { runOrchestrator } from '@/lib/agents/orchestrator/core'
import type { ConversationTurn } from '@/lib/agents/orchestrator/core'

const isDev = process.env.NODE_ENV !== 'production'

function failure(stage: string, err: unknown, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[orchestrator] stage=${stage} FAILED`, err)
  return NextResponse.json(
    {
      error: 'orchestrator_failed',
      stage,
      message: isDev ? message : 'Something went wrong. Please try again.',
    },
    { status },
  )
}

interface SubmitBody {
  submission_text: string
  user_guidance?: string
  active_context?: string
  input_type?: 'typed' | 'dictated' | 'pasted' | 'file_upload' | 'voice'
  conversation_history?: ConversationTurn[]
}

export async function POST(request: NextRequest) {
  let stage = 'auth'
  try {
    const userClient = createUserClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    stage = 'parse-body'
    const body = (await request.json()) as SubmitBody
    const submission_text = (body.submission_text ?? '').trim()
    if (!submission_text) {
      return NextResponse.json({ error: 'submission_text is required' }, { status: 400 })
    }

    stage = 'run-orchestrator'
    const response = await runOrchestrator({
      user_id: user.id,
      submission_text,
      user_guidance: body.user_guidance,
      active_context: body.active_context,
      input_type: body.input_type ?? 'typed',
      conversation_history: body.conversation_history,
    })

    return NextResponse.json(response)
  } catch (err) {
    return failure(stage, err)
  }
}
