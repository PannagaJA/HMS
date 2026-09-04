import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'pannagaja@gmail.com',
    password: 'amc@2026'
  })
  
  if (error) {
    console.log("Login error:", error)
    return
  }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  console.log("Profile:", profile, "Error:", pErr)
}
test()
