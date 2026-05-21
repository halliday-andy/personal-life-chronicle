import Anthropic from '@anthropic-ai/sdk'

/**
 * Default model for sub-agents. Sonnet 4.5 is the right balance of reasoning
 * quality and latency for inline tool use in the orchestrator's response path.
 * Specific agents may override (e.g. the orchestrator itself uses the same).
 */
export const DEFAULT_AGENT_MODEL = 'claude-sonnet-4-5'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY missing from env')
  }
  _client = new Anthropic({ apiKey })
  return _client
}
