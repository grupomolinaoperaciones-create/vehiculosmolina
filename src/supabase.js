import { createClient } from '@supabase/supabase-js'
const SUPABASE_URL = 'https://wvtuankidmibzqgiydfy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VgROHnIIDWf2jufAd7ow7Q_83uayawM'
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
