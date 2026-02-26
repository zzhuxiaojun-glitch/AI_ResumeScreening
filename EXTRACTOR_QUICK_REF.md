# Structured Extraction - Quick Reference

## Current Status

**Active Extractor**: rule-based-extractor v1.0.0
**Extracted Fields**: name, school, education, age, gender (+ 7 additional)
**Accuracy**: 60-80% (standard resumes)
**Speed**: < 10ms per resume

## Core Files

```
supabase/functions/shared/
├── extractor-interface.ts    # Interface contract
├── extractor-factory.ts      # Plugin selector
└── rule-based-extractor.ts   # Current implementation

supabase/functions/parse-resume/
└── index.ts                   # Integration point
```

## Switch Extractor

```bash
# In Supabase dashboard, set environment variable:
EXTRACTOR_TYPE=rule-based  # Current (default)
EXTRACTOR_TYPE=ai          # Future: AI-based
EXTRACTOR_TYPE=ocr         # Future: OCR-based
```

## Add New Extractor

### 1. Create Implementation

```typescript
// supabase/functions/shared/ai-extractor.ts
import type { StructuredExtractor, ExtractionResult } from "./extractor-interface.ts";

export class AIExtractor implements StructuredExtractor {
  readonly name = "ai-extractor";
  readonly version = "1.0.0";

  async extract(rawText: string): Promise<ExtractionResult> {
    // Call AI API
    // Parse response
    // Return StructuredData
  }
}
```

### 2. Register in Factory

```typescript
// supabase/functions/shared/extractor-factory.ts
case "ai":
  return new AIExtractor();
```

### 3. Deploy

```bash
# Copy to parse-resume directory
cp supabase/functions/shared/*.ts supabase/functions/parse-resume/

# Set environment variable in Supabase
EXTRACTOR_TYPE=ai

# Deployment happens automatically
```

## Extracted Fields

### Core (5 fields)
- **name**: 姓名 / Name
- **school**: 学校 / School
- **education**: 学历 / Education level
- **age**: 年龄 / Age (18-70)
- **gender**: 性别 / Gender (男/女/unknown)

### Additional (7 fields)
- phone, email, major, graduation_date
- work_years, skills[], projects[]

### Metadata
- extraction_confidence (0-100)
- extraction_method
- extraction_timestamp
- warnings[], errors[]

## Extraction Patterns (Rule-Based)

| Field | Pattern Examples |
|-------|-----------------|
| Name | `姓名: 张三`, first line 2-10 chars |
| School | `北京大学`, `MIT University` |
| Education | `博士`, `硕士`, `本科`, `Master`, `Bachelor` |
| Age | `年龄: 25`, `25岁`, birth year calculation |
| Gender | `性别: 男`, `Gender: Male` |

## Check Extraction Results

### In Database

```sql
SELECT
  name, school, education, age, gender,
  extraction_metadata->'structured'->>'confidence' as confidence,
  extraction_metadata->'structured'->>'method' as method,
  extraction_metadata->'structured'->'warnings' as warnings
FROM candidates
WHERE id = 'xxx';
```

### In UI

**Candidates List**: Shows all fields in grid
**Candidate Detail**: Full info + raw text view

## Troubleshooting

### All Fields Empty

```
Check: extraction_status, raw_text, extraction_metadata
Fix: Verify PDF extraction worked, check resume format
```

### Wrong Extractor

```
Check: Edge Function logs "Using extractor: ..."
Fix: Set EXTRACTOR_TYPE in Supabase dashboard
```

### Low Confidence (<60%)

```
Check: extraction_metadata.structured.warnings
Fix: Add patterns, use AI extractor, or manual review
```

## Performance Comparison

| Extractor | Speed | Cost | Accuracy | Best For |
|-----------|-------|------|----------|----------|
| Rule-Based | <10ms | Free | 60-80% | High volume, standard formats |
| AI (future) | 1-3s | ~$0.01 | 90-95% | Complex formats, high accuracy |
| Hybrid (future) | Variable | Low | Best | All scenarios |

## Key Principles

1. **Pure Function**: No side effects, no DB calls
2. **Never Throw**: Return errors array
3. **Empty Not Null**: "" for missing text
4. **Validate Data**: Age 18-70, email format
5. **No Content Logs**: Never log raw_text

## Environment Variables

```bash
# Main app (.env)
PDF_EXTRACTOR_URL=http://localhost:5000

# Edge Function (Supabase dashboard)
EXTRACTOR_TYPE=rule-based
OPENAI_API_KEY=sk-...  # If using AI
```

## Quick Test

```typescript
const extractor = new RuleBasedExtractor();
const result = extractor.extract("姓名: 张三\n学校: 清华大学\n学历: 硕士");

console.log(result.data.name);       // "张三"
console.log(result.data.school);     // "清华大学"
console.log(result.data.education);  // "硕士"
```

## Documentation

- **Full Guide**: `STRUCTURED_EXTRACTION_GUIDE.md`
- **Chinese Summary**: `结构化提取集成说明.md`
- **This File**: Quick reference

## Status Checks

```bash
# Check current extractor
# View Edge Function logs in Supabase dashboard
# Look for: "Using extractor: rule-based-extractor v1.0.0"

# Check extraction results
# Query candidates table
# View extraction_metadata.structured field
```

## Common Patterns

### Empty Result Handling

```typescript
const name = extracted.name || "Unknown";
const age = extracted.age || null;
const gender = extracted.gender === "unknown" ? "N/A" : extracted.gender;
```

### Confidence Threshold

```typescript
if (extracted.extraction_confidence < 60) {
  // Flag for manual review
  status = "needs_review";
}
```

### Error Logging

```typescript
if (!extractionResult.success) {
  console.warn("Extraction failed:", extractionResult.errors);
  // Don't log raw_text!
}
```

## Next Steps

1. ✅ Test with real resumes
2. ✅ Monitor confidence scores
3. 🔄 Adjust patterns as needed
4. 🔄 Add AI extractor when ready
5. 🔄 Implement hybrid mode

---

For detailed information, see `STRUCTURED_EXTRACTION_GUIDE.md`
