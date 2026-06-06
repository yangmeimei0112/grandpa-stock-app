import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let _supabase = null
if (supabaseUrl && supabaseAnonKey) {
	_supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
	const missing = []
	if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
	if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY')
	console.error(`[supabase] Missing env: ${missing.join(', ')}. Add values to .env or build env. See .env.example.`)
}

export const supabase = _supabase