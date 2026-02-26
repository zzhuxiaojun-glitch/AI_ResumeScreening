# PDF Extraction Quick Reference

## Start Services

### One Command (Easiest)
```bash
# Linux/Mac
./START_SERVICES.sh

# Windows
START_SERVICES.bat
```

### Manual Start
```bash
# Terminal 1 - PDF Service
cd pdf-extractor
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Terminal 2 - Web App
npm run dev
```

## URLs
- Web App: http://localhost:5173
- PDF Service: http://localhost:5000

## Test PDF Service
```bash
cd pdf-extractor
python test_service.py
```

## Configuration

### .env (Main App)
```bash
PDF_EXTRACTOR_URL=http://localhost:5000
```

### pdf-extractor/.env
```bash
PORT=5000
MAX_FILE_SIZE_MB=10
MIN_TEXT_LENGTH=100
```

## Data Fields

### candidates table
- `raw_text` - Extracted text
- `extraction_status` - success/needs_review/failed/pending
- `extraction_metadata` - {pages, chars, hint, extracted_at}
- `raw_text_source` - pymupdf/fallback/ocr

## UI Location

Candidate Detail Page → "Extracted Text" section
- Click to expand/collapse
- Shows status badge (green/yellow/red/gray)
- Copy button for text
- Metadata (pages, chars, source)

## Status Meanings

| Status | Meaning |
|--------|---------|
| success | Text extracted successfully (≥100 chars) |
| needs_review | Possibly scanned or very short text |
| failed | Extraction error occurred |
| pending | Not yet processed |

## Troubleshooting

### Service won't start
```bash
# Check Python
python3 --version

# Install deps
cd pdf-extractor
pip install -r requirements.txt
```

### No text extracted
- Check if PDF is scanned (image-based)
- Check extraction_metadata.hint for details
- Consider adding OCR support

### Connection refused
- Verify Python service is running
- Check PDF_EXTRACTOR_URL in .env
- Test: curl http://localhost:5000/health

## API Endpoints

### Health Check
```bash
curl http://localhost:5000/health
```

### Extract Text
```bash
curl -X POST http://localhost:5000/extract-text \
  -F "file=@resume.pdf"
```

## Documentation

- **Full Setup**: PDF_EXTRACTION_SETUP.md
- **Service Details**: pdf-extractor/README.md
- **Integration**: INTEGRATION_COMPLETE.md
- **Main App**: README.md
