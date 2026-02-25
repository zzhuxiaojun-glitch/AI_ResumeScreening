/*
  # AI Resume Screening System Schema

  ## Overview
  Complete database schema for AI-powered resume screening and candidate management system.

  ## Tables Created
  
  ### 1. positions
  Stores job position information and scoring rules
  - `id` (uuid, primary key)
  - `title` (text) - Position title
  - `description` (text) - Job description
  - `must_skills` (jsonb) - Required skills array with weights
  - `nice_skills` (jsonb) - Preferred skills array with weights
  - `reject_keywords` (jsonb) - Auto-reject keywords array
  - `grade_thresholds` (jsonb) - Score thresholds for A/B/C/D grading
  - `status` (text) - active/archived
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. resumes
  Stores uploaded resume files metadata
  - `id` (uuid, primary key)
  - `position_id` (uuid, foreign key)
  - `file_name` (text)
  - `file_path` (text) - Supabase storage path
  - `file_size` (integer)
  - `file_type` (text) - PDF/DOC/DOCX
  - `upload_source` (text) - manual/email
  - `status` (text) - pending/parsed/failed
  - `parse_error` (text)
  - `created_at` (timestamptz)

  ### 3. candidates
  Stores parsed candidate information
  - `id` (uuid, primary key)
  - `resume_id` (uuid, foreign key)
  - `position_id` (uuid, foreign key)
  - `name` (text)
  - `phone` (text)
  - `email` (text)
  - `education` (text) - 本科/硕士/博士
  - `school` (text)
  - `major` (text)
  - `graduation_date` (date)
  - `work_years` (numeric)
  - `skills` (jsonb) - Array of skills
  - `projects` (jsonb) - Array of project descriptions
  - `highlights` (jsonb) - Top 3 highlights
  - `risks` (jsonb) - Top 3 risk points
  - `missing_fields` (jsonb) - Array of missing required fields
  - `raw_text` (text) - Full extracted text
  - `current_status` (text) - new/reviewed/interview/rejected/hired
  - `notes` (text) - HR notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. scores
  Stores candidate scoring results
  - `id` (uuid, primary key)
  - `candidate_id` (uuid, foreign key)
  - `total_score` (numeric) - 0-100
  - `grade` (text) - A/B/C/D
  - `must_score` (numeric)
  - `nice_score` (numeric)
  - `reject_penalty` (numeric)
  - `scoring_details` (jsonb) - Detailed breakdown
  - `explanation` (text) - Human-readable explanation
  - `matched_must` (jsonb) - Matched required skills
  - `matched_nice` (jsonb) - Matched preferred skills
  - `matched_reject` (jsonb) - Matched reject keywords
  - `missing_must` (jsonb) - Missing required skills
  - `created_at` (timestamptz)

  ### 5. email_configs
  Stores IMAP email configuration for resume import
  - `id` (uuid, primary key)
  - `position_id` (uuid, foreign key)
  - `server` (text)
  - `port` (integer)
  - `email` (text)
  - `password` (text) - Encrypted
  - `folder` (text) - INBOX/收件箱
  - `search_keywords` (text)
  - `last_sync_at` (timestamptz)
  - `is_active` (boolean)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Authenticated users can read/write all data (simplified for MVP)
*/

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  must_skills jsonb DEFAULT '[]'::jsonb,
  nice_skills jsonb DEFAULT '[]'::jsonb,
  reject_keywords jsonb DEFAULT '[]'::jsonb,
  grade_thresholds jsonb DEFAULT '{"A": 80, "B": 60, "C": 40, "D": 0}'::jsonb,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES positions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer DEFAULT 0,
  file_type text DEFAULT 'pdf',
  upload_source text DEFAULT 'manual',
  status text DEFAULT 'pending',
  parse_error text,
  created_at timestamptz DEFAULT now()
);

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id) ON DELETE CASCADE,
  name text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  education text DEFAULT '',
  school text DEFAULT '',
  major text DEFAULT '',
  graduation_date date,
  work_years numeric DEFAULT 0,
  skills jsonb DEFAULT '[]'::jsonb,
  projects jsonb DEFAULT '[]'::jsonb,
  highlights jsonb DEFAULT '[]'::jsonb,
  risks jsonb DEFAULT '[]'::jsonb,
  missing_fields jsonb DEFAULT '[]'::jsonb,
  raw_text text DEFAULT '',
  current_status text DEFAULT 'new',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create scores table
CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  total_score numeric DEFAULT 0,
  grade text DEFAULT 'D',
  must_score numeric DEFAULT 0,
  nice_score numeric DEFAULT 0,
  reject_penalty numeric DEFAULT 0,
  scoring_details jsonb DEFAULT '{}'::jsonb,
  explanation text DEFAULT '',
  matched_must jsonb DEFAULT '[]'::jsonb,
  matched_nice jsonb DEFAULT '[]'::jsonb,
  matched_reject jsonb DEFAULT '[]'::jsonb,
  missing_must jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create email_configs table
CREATE TABLE IF NOT EXISTS email_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES positions(id) ON DELETE CASCADE,
  server text NOT NULL,
  port integer DEFAULT 993,
  email text NOT NULL,
  password text NOT NULL,
  folder text DEFAULT 'INBOX',
  search_keywords text DEFAULT '',
  last_sync_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (simplified for MVP)
CREATE POLICY "Authenticated users can manage positions"
  ON positions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage resumes"
  ON resumes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage candidates"
  ON candidates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage scores"
  ON scores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage email configs"
  ON email_configs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resumes_position ON resumes(position_id);
CREATE INDEX IF NOT EXISTS idx_resumes_status ON resumes(status);
CREATE INDEX IF NOT EXISTS idx_candidates_position ON candidates(position_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(current_status);
CREATE INDEX IF NOT EXISTS idx_candidates_resume ON candidates(resume_id);
CREATE INDEX IF NOT EXISTS idx_scores_candidate ON scores(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_configs_position ON email_configs(position_id);