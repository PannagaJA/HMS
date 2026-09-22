import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://gnmbmwplrjwkslvtcghr.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdubWJtd3Bscmp3a3NsdnRjZ2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjUyNDMsImV4cCI6MjEwMzk0MTI0M30.le1zoiyxBSb6mPH5iI9rLaSnS1ltYl0rmgxUwPk4SOE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
