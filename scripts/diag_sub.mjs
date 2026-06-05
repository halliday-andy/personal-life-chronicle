import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const subId = 'ac0764ad-9f39-498f-ba3e-e33c2da6be68'
const { data: s } = await admin
  .from('capture_submissions')
  .select('*')
  .eq('id', subId)
  .single()
console.log('CAPTURE_SUBMISSION ac0764ad (the one that produced the Apollo 11 memory):')
console.log(JSON.stringify(s, null, 2))
