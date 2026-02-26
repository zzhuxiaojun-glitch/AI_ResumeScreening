/*
  # Add Age and Gender Fields to Candidates

  ## Changes Made
  
  1. New Columns for candidates table
    - `age` (integer): Candidate age
    - `gender` (text): Candidate gender (男/女/male/female/unknown)
    
  2. Notes
    - Fields are nullable to support partial extraction
    - Existing RLS policies apply to new columns
    - Default to NULL when not extracted
    
  ## Security
    - Existing RLS policies cover these fields
*/

-- Add age and gender fields to candidates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'age'
  ) THEN
    ALTER TABLE candidates ADD COLUMN age integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'gender'
  ) THEN
    ALTER TABLE candidates ADD COLUMN gender text;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN candidates.age IS 'Candidate age extracted from resume';
COMMENT ON COLUMN candidates.gender IS 'Candidate gender (男/女/male/female/unknown)';