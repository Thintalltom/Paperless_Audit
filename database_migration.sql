-- Add approval tracking columns to Request_table
ALTER TABLE Request_table ADD COLUMN IF NOT EXISTS current_approval_level INTEGER DEFAULT 0;
ALTER TABLE Request_table ADD COLUMN IF NOT EXISTS approval_status JSONB DEFAULT '{}';
ALTER TABLE Request_table ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]';

-- Create approval_actions table for detailed tracking
CREATE TABLE IF NOT EXISTS approval_actions (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES Request_table(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES admin_profile(id),
  approval_level INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'declined', 'kiv')),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_approval_actions_request_id ON approval_actions(request_id);
CREATE INDEX IF NOT EXISTS idx_request_approval_level ON Request_table(current_approval_level);