/*
  # Create Storage Bucket for Resumes

  ## Overview
  Sets up Supabase Storage bucket for resume file uploads

  ## Changes
  1. Creates 'resumes' storage bucket if it doesn't exist
  2. Sets up storage policies for authenticated users to upload and download resumes
  
  ## Security
  - Only authenticated users can upload files
  - Only authenticated users can download files
  - Files are stored in a private bucket
*/

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload resumes'
  ) THEN
    CREATE POLICY "Authenticated users can upload resumes"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'resumes');
  END IF;
END $$;

-- Policy: Allow authenticated users to read resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can read resumes'
  ) THEN
    CREATE POLICY "Authenticated users can read resumes"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'resumes');
  END IF;
END $$;

-- Policy: Allow authenticated users to delete resumes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete resumes'
  ) THEN
    CREATE POLICY "Authenticated users can delete resumes"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'resumes');
  END IF;
END $$;