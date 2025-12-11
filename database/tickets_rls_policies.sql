-- tickets_rls_policies.sql
-- Row Level Security policies for tickets table

-- Enable Row Level Security on tickets table (if not already enabled)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can read tickets" ON tickets;
DROP POLICY IF EXISTS "Anyone can insert tickets" ON tickets;
DROP POLICY IF EXISTS "Anyone can update tickets" ON tickets;
DROP POLICY IF EXISTS "TAs can update tickets" ON tickets;

-- Policy: Anyone can read tickets
CREATE POLICY "Anyone can read tickets" ON tickets
  FOR SELECT USING (true);

-- Policy: Anyone can insert tickets
CREATE POLICY "Anyone can insert tickets" ON tickets
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update tickets (for now - can be restricted later if needed)
-- This allows the frontend (using anon key) to update ticket status, assignments, etc.
CREATE POLICY "Anyone can update tickets" ON tickets
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Verify policies were created
SELECT 'tickets RLS policies created successfully' AS status;
