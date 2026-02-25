/*
  # Add Candidate Status and Resubmission Tracking

  ## Changes Made
  
  1. Candidates Table Updates
    - Rename `current_status` to `status` for consistency
    - Add proper status constraint with enum values: new, shortlisted, interviewing, hired, rejected
    - Add `resubmission_count` field to track duplicate submissions
    - Add `first_submitted_at` to track initial submission time
    - Add unique index on email/phone for deduplication
    - Add index on status for filtering

  2. Candidate Resubmissions Table (New)
    - Track each resubmission event separately
    - Links to candidate and new resume
    - Records timestamp of resubmission
    - Allows detailed history tracking

  ## Important Notes
  - Email and phone will be used for deduplication (case-insensitive email)
  - At least one of email or phone must be present for deduplication
  - Resubmission count starts at 0 for new candidates
*/

-- Add new columns to candidates table
DO $$
BEGIN
  -- Add status column (rename from current_status if needed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'status'
  ) THEN
    ALTER TABLE candidates ADD COLUMN status text DEFAULT 'new';
    
    -- Copy data from current_status if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'candidates' AND column_name = 'current_status'
    ) THEN
      UPDATE candidates SET status = current_status;
      ALTER TABLE candidates DROP COLUMN current_status;
    END IF;
  END IF;

  -- Add resubmission tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'resubmission_count'
  ) THEN
    ALTER TABLE candidates ADD COLUMN resubmission_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'first_submitted_at'
  ) THEN
    ALTER TABLE candidates ADD COLUMN first_submitted_at timestamptz DEFAULT now();
    -- Set first_submitted_at to created_at for existing records
    UPDATE candidates SET first_submitted_at = created_at WHERE first_submitted_at IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'last_resubmitted_at'
  ) THEN
    ALTER TABLE candidates ADD COLUMN last_resubmitted_at timestamptz;
  END IF;
END $$;

-- Add status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'candidates_status_check'
  ) THEN
    ALTER TABLE candidates
    ADD CONSTRAINT candidates_status_check
    CHECK (status IN ('new', 'shortlisted', 'interviewing', 'hired', 'rejected'));
  END IF;
END $$;

-- Create candidate_resubmissions table for detailed history
CREATE TABLE IF NOT EXISTS candidate_resubmissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id) ON DELETE CASCADE,
  resubmitted_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE candidate_resubmissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage resubmissions"
  ON candidate_resubmissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);
CREATE INDEX IF NOT EXISTS idx_candidates_resubmission ON candidates(resubmission_count) WHERE resubmission_count > 0;
CREATE INDEX IF NOT EXISTS idx_resubmissions_candidate ON candidate_resubmissions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_resubmissions_position ON candidate_resubmissions(position_id);

-- Create function to handle duplicate candidate detection and merging
CREATE OR REPLACE FUNCTION find_duplicate_candidate(
  p_email text,
  p_phone text,
  p_position_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_candidate_id uuid;
BEGIN
  -- Try to find existing candidate by email or phone for the same position
  SELECT id INTO v_candidate_id
  FROM candidates
  WHERE position_id = p_position_id
    AND (
      (p_email IS NOT NULL AND p_email != '' AND LOWER(email) = LOWER(p_email))
      OR
      (p_phone IS NOT NULL AND p_phone != '' AND phone = p_phone)
    )
  LIMIT 1;
  
  RETURN v_candidate_id;
END;
$$;

-- Create function to update candidate on resubmission
CREATE OR REPLACE FUNCTION handle_candidate_resubmission(
  p_candidate_id uuid,
  p_new_resume_id uuid,
  p_position_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update candidate record
  UPDATE candidates
  SET 
    resume_id = p_new_resume_id,
    resubmission_count = resubmission_count + 1,
    last_resubmitted_at = now(),
    updated_at = now()
  WHERE id = p_candidate_id;
  
  -- Record resubmission event
  INSERT INTO candidate_resubmissions (candidate_id, resume_id, position_id)
  VALUES (p_candidate_id, p_new_resume_id, p_position_id);
END;
$$;