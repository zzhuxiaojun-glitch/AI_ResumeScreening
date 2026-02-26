/**
 * Structured Extractor Interface
 *
 * This defines the contract for all structured extractors (rule-based, AI, OCR, etc.)
 * All implementations must conform to this interface for plug-and-play compatibility.
 */

export interface StructuredData {
  name: string;
  school: string;
  education: string;
  age: number | null;
  gender: string;

  // Additional fields for compatibility with existing system
  phone?: string;
  email?: string;
  major?: string;
  graduation_date?: string | null;
  work_years?: number;
  skills?: string[];
  projects?: string[];

  // Metadata about extraction
  extraction_confidence?: number;
  extraction_method?: string;
  extraction_timestamp?: string;
}

export interface ExtractionResult {
  success: boolean;
  data: StructuredData;
  warnings?: string[];
  errors?: string[];
}

/**
 * Base interface that all extractors must implement
 */
export interface StructuredExtractor {
  readonly name: string;
  readonly version: string;

  /**
   * Extract structured data from raw text
   *
   * @param rawText - The raw text extracted from PDF/document
   * @returns ExtractionResult with structured data and status
   *
   * IMPORTANT: Must be pure function - no side effects, no DB calls, no HTTP requests
   * IMPORTANT: Must handle errors gracefully - never throw, always return result with errors array
   * IMPORTANT: Must return empty/unknown values for missing data, not fail
   */
  extract(rawText: string): Promise<ExtractionResult> | ExtractionResult;
}

/**
 * Factory function type for creating extractors
 */
export type ExtractorFactory = () => StructuredExtractor;
