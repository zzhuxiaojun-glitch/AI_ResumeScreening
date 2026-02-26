/*
  # Add PDF Text Extraction Fields

  ## Changes Made
  
  1. New Columns for candidates table
    - `raw_text` (text): Full extracted text from PDF resume
    - `extraction_status` (text): Status of extraction (success/needs_review/failed)
    - `extraction_metadata` (jsonb): Metadata about extraction (pages, chars, hints)
    - `raw_text_source` (text): Source of raw text (pymupdf/ocr/manual/etc)
    
  2. Add index for extraction_status filtering
    - Index on extraction_status for filtering candidates needing review
    
  ## Security
    - Existing RLS policies apply to new columns
    
  ## Notes
    - extraction_status values: 'success', 'needs_review', 'failed', 'pending'
    - extraction_metadata stores: { pages, chars, hint, extracted_at }
    - raw_text_source tracks which extraction method was used (future extensibility)
*/

-- Add PDF extraction fields to candidates table
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS raw_text text,
ADD COLUMN IF NOT EXISTS extraction_status text DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'success', 'needs_review', 'failed')),
ADD COLUMN IF NOT EXISTS extraction_metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS raw_text_source text;

-- Add index for filtering by extraction status
CREATE INDEX IF NOT EXISTS idx_candidates_extraction_status ON candidates(extraction_status);

-- Add comment for documentation
COMMENT ON COLUMN candidates.raw_text IS 'Full text extracted from PDF resume';
COMMENT ON COLUMN candidates.extraction_status IS 'Status of PDF text extraction: pending/success/needs_review/failed';
COMMENT ON COLUMN candidates.extraction_metadata IS 'Metadata: pages, chars, extraction hints, timestamp';
COMMENT ON COLUMN candidates.raw_text_source IS 'Source of extraction: pymupdf, ocr, manual, etc';