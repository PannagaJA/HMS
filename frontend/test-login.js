import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'pannagaja@gmail.com',
    password: 'amc@2026'
  })
  console.log("Login result:", error ? error.message : "Success! User ID: " + data.user.id)
}
test()
