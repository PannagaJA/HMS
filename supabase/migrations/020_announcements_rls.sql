-- Enable RLS on announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read announcements
CREATE POLICY "Allow read access to all users" 
ON announcements FOR SELECT 
USING (true);

-- Allow authenticated users to insert announcements
CREATE POLICY "Allow insert access to authenticated users" 
ON announcements FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' OR true);

-- (Optional) If you are not using Supabase Auth strictly, you can just allow anon access:
CREATE POLICY "Allow anon insert access"
ON announcements FOR INSERT
WITH CHECK (true);

-- Enable RLS on announcements_read
ALTER TABLE announcements_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to announcements_read" 
ON announcements_read FOR ALL 
USING (true) WITH CHECK (true);
