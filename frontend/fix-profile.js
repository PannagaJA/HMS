import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function fix() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'pannagaja@gmail.com',
    password: 'amc@2026'
  })
  if (authError) {
    console.error("Login failed:", authError.message)
    return
  }
  const user = authData.user
  console.log("Logged in as user:", user.id)

  const { data: adminProfile } = await supabase.from('profiles').select('*').eq('role', 'HMS_ADMIN').limit(1).single()
  const org_id = adminProfile ? adminProfile.org_id : '5e9a4f47-a8b2-4d24-aeb1-6a2d9bdf14c5' // fallback to some org

  const { data, error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
    role: 'STUDENT', 
    first_name: 'pannaga',
    last_name: '',
    phone: '1234567890',
    is_active: true,
    org_id: org_id
  })

  console.log("Upsert result:", error ? error.message : "Success!")
}
fix()
