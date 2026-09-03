-- Create Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
  id text PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  priority text DEFAULT 'low',
  target_roles text[] NOT NULL,
  created_by_role text,
  created_by_name text,
  is_circular boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- Table to track which announcements have been read by which users
CREATE TABLE IF NOT EXISTS announcements_read (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id text REFERENCES announcements(id) ON DELETE CASCADE,
  user_id text, -- assuming your auth users are text or uuid
  created_at timestamptz DEFAULT now()
);
