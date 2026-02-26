/**
 * Extractor Factory
 *
 * This factory provides the mechanism to switch between different extraction implementations.
 * Environment variable EXTRACTOR_TYPE controls which implementation is used.
 *
 * Supported types:
 * - "rule-based" (default): Rule-based regex extractor
 * - "ai": AI-based extractor (future implementation)
 * - "ocr": OCR-based extractor (future implementation)
 *
 * To add a new extractor:
 * 1. Implement StructuredExtractor interface
 * 2. Add case to getExtractor() switch statement
 * 3. Set EXTRACTOR_TYPE environment variable
 */

import type { StructuredExtractor } from "./extractor-interface.ts";
import { RuleBasedExtractor } from "./rule-based-extractor.ts";

export type ExtractorType = "rule-based" | "ai" | "ocr";

export class ExtractorFactory {
  /**
   * Get the configured extractor instance
   *
   * @param type - Extractor type (defaults to EXTRACTOR_TYPE env var or "rule-based")
   * @returns Configured extractor instance
   */
  static getExtractor(type?: ExtractorType): StructuredExtractor {
    const extractorType =
      type ||
      (Deno.env.get("EXTRACTOR_TYPE") as ExtractorType) ||
      "rule-based";

    switch (extractorType) {
      case "rule-based":
        return new RuleBasedExtractor();

      case "ai":
        // Future: Return AI-based extractor
        // return new AIExtractor();
        console.warn(
          "AI extractor not yet implemented, falling back to rule-based"
        );
        return new RuleBasedExtractor();

      case "ocr":
        // Future: Return OCR-based extractor
        // return new OCRExtractor();
        console.warn(
          "OCR extractor not yet implemented, falling back to rule-based"
        );
        return new RuleBasedExtractor();

      default:
        console.warn(
          `Unknown extractor type: ${extractorType}, falling back to rule-based`
        );
        return new RuleBasedExtractor();
    }
  }

  /**
   * Get list of available extractor types
   */
  static getAvailableTypes(): ExtractorType[] {
    return ["rule-based"]; // Future: add "ai", "ocr" when implemented
  }

  /**
   * Check if an extractor type is available
   */
  static isTypeAvailable(type: ExtractorType): boolean {
    return this.getAvailableTypes().includes(type);
  }
}
