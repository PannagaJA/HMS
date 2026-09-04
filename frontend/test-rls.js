import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@amc.edu',
    password: 'password123'
  })
  if (authError) {
    console.error("Login failed:", authError.message)
    return
  }
  
  // Try to update someone else's profile
  const { data, error } = await supabase.from('profiles').update({ is_active: false }).eq('role', 'WARDEN').select()
  console.log("Update result:", error ? error.message : data)
}
test()
