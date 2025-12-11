-- ticket_feedback_schema.sql
-- Database schema for ticket feedback table

-- Create ticket_feedback table
CREATE TABLE IF NOT EXISTS ticket_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ta_email TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'note', -- 'note', 'response', 'question'
  is_internal BOOLEAN DEFAULT FALSE, -- Internal notes not visible to students
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ticket_feedback_ticket_id ON ticket_feedback(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_feedback_created_at ON ticket_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_feedback_ta_email ON ticket_feedback(ta_email);

-- Enable Row Level Security
ALTER TABLE ticket_feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can read feedback" ON ticket_feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON ticket_feedback;
DROP POLICY IF EXISTS "Only service role can insert feedback" ON ticket_feedback;
DROP POLICY IF EXISTS "Only service role can update feedback" ON ticket_feedback;

-- Policy: Anyone can read feedback (students can see feedback on their tickets)
-- Note: Students will see only non-internal feedback in the application layer
CREATE POLICY "Anyone can read feedback" ON ticket_feedback
  FOR SELECT USING (true);

-- Policy: Allow inserts (TAs can add feedback via dashboard)
-- Note: The frontend should validate TA permissions
CREATE POLICY "Anyone can insert feedback" ON ticket_feedback
  FOR INSERT WITH CHECK (true);

-- Policy: Allow updates (TAs can edit their feedback)
CREATE POLICY "Anyone can update feedback" ON ticket_feedback
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ticket_feedback_updated_at ON ticket_feedback;
CREATE TRIGGER ticket_feedback_updated_at
  BEFORE UPDATE ON ticket_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_feedback_updated_at();

-- Verify table was created
SELECT 'ticket_feedback table created successfully' AS status;

