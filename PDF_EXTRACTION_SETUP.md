# PDF Text Extraction Setup Guide

This guide explains how to set up and use the PDF text extraction feature in the AI Resume Screening ATS system.

## Overview

The system uses a separate Python microservice to extract text from PDF resumes using PyMuPDF (fitz). This architecture provides:

- **Fast and reliable** text extraction from text-based PDFs
- **Separation of concerns** - Python service is independent of the main web app
- **Easy deployment** - Can run locally or on company servers
- **Extensibility** - Easy to add OCR or support for other file formats in the future

## Architecture

```
┌─────────────────┐
│   Web App       │
│  (React + TS)   │
└────────┬────────┘
         │
         │ HTTP API
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Edge Function  │────▶│  Python Service  │
│  (parse-resume) │     │  (PDF Extractor) │
└─────────────────┘     └────────┬─────────┘
         │                       │
         │                       │ PyMuPDF
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│    Supabase     │     │   PDF Document   │
│    Database     │     └──────────────────┘
└─────────────────┘
```

## Quick Start

### 1. Start the Python PDF Extraction Service

```bash
# Navigate to the pdf-extractor directory
cd pdf-extractor

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the service
python app.py
```

The service will start on `http://localhost:5000`

### 2. Configure the Main Application

The `.env` file already contains the configuration:

```bash
PDF_EXTRACTOR_URL=http://localhost:5000
```

For production, update this to your deployed Python service URL.

### 3. Start the Main Application

```bash
# In the project root directory
npm install
npm run dev
```

### 4. Test the Integration

1. Log in to the application
2. Go to Positions and create a position
3. Upload a PDF resume
4. The system will automatically:
   - Extract text using the Python service
   - Save the extracted text to the database
   - Display extraction status in the UI

## How It Works

### 1. Resume Upload

When a user uploads a PDF resume:
1. File is uploaded to Supabase Storage
2. Edge Function `parse-resume` is triggered
3. Edge Function downloads the PDF from storage

### 2. Text Extraction

The Edge Function calls the Python service:

```typescript
// Call PDF extraction service
const formData = new FormData();
formData.append("file", fileData, "resume.pdf");

const response = await fetch(`${pdfExtractorUrl}/extract-text`, {
  method: "POST",
  body: formData,
});

const result = await response.json();
// result = { ok, text, pages, chars, status, hint }
```

### 3. Data Storage

Extracted data is saved to the `candidates` table:

| Field | Description |
|-------|-------------|
| `raw_text` | Full extracted text from the PDF |
| `extraction_status` | `success`, `needs_review`, `failed`, or `pending` |
| `extraction_metadata` | JSON with pages, chars, hint, extracted_at |
| `raw_text_source` | Source of extraction (e.g., `pymupdf`, `fallback`) |

### 4. Status Handling

The system intelligently handles different scenarios:

- **Success**: Text extracted with reasonable length
- **Needs Review**:
  - No text extracted (likely scanned PDF)
  - Very short text (< 100 characters)
  - Possible encoding issues
- **Failed**: Service error or invalid PDF

## UI Features

### Candidate Detail Page

The candidate detail page now shows:

1. **Extraction Status Badge**: Visual indicator of extraction success
2. **Extraction Metadata**: Pages, character count, source
3. **Status Hints**: Helpful messages for review cases
4. **Collapsible Raw Text**:
   - Click to expand/collapse
   - Scrollable view for long text
   - Copy button for easy copying
5. **Manual Review Indicator**: Yellow badge for `needs_review` status

## Configuration

### Python Service (.env in pdf-extractor/)

```bash
PORT=5000                    # Server port
FLASK_ENV=development        # development or production
MAX_FILE_SIZE_MB=10          # Maximum file size
MIN_TEXT_LENGTH=100          # Minimum chars for success
```

### Main Application (.env)

```bash
PDF_EXTRACTOR_URL=http://localhost:5000  # Python service URL
```

### Edge Function Environment

The Edge Function automatically reads `PDF_EXTRACTOR_URL` from environment variables. In production, set this in your Supabase project settings.

## Deployment

### Local Development

Both services run on localhost:
- Web app: `http://localhost:5173` (Vite dev server)
- Python service: `http://localhost:5000`

### Production Deployment

#### Option 1: Deploy Python Service to Company Server

1. Copy `pdf-extractor/` directory to server
2. Install Python 3.8+ and dependencies
3. Use Gunicorn or similar to run the service
4. Set up nginx/Apache as reverse proxy with HTTPS
5. Update `PDF_EXTRACTOR_URL` in Supabase project settings

Example with Gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 --timeout 60 app:app
```

#### Option 2: Docker Deployment

See `pdf-extractor/README.md` for Docker setup instructions.

#### Option 3: Cloud Deployment

Deploy to AWS/Azure/GCP:
- AWS: Elastic Beanstalk, ECS, or Lambda
- Azure: App Service or Functions
- GCP: Cloud Run or App Engine

## Security Considerations

### Implemented Security Measures

1. **File Type Validation**: Only PDF files accepted
2. **File Size Limits**: Configurable maximum size
3. **Secure Filenames**: Uses `secure_filename()` to prevent path traversal
4. **Temporary Files**: Processed files are immediately deleted
5. **No Content Logging**: Sensitive resume text is not logged
6. **CORS Headers**: Properly configured for cross-origin requests

### Production Security Checklist

- [ ] Use HTTPS for all communications
- [ ] Set up authentication/API keys for the Python service
- [ ] Implement rate limiting
- [ ] Use environment variables for all secrets
- [ ] Set up proper firewall rules
- [ ] Enable request logging (without content)
- [ ] Regular security updates for dependencies

## Troubleshooting

### Python Service Won't Start

**Problem**: `ModuleNotFoundError: No module named 'fitz'`

**Solution**: Make sure PyMuPDF is installed:
```bash
pip install PyMuPDF
```

### Extraction Returns Empty Text

**Problem**: PDF extraction returns 0 characters

**Possible Causes**:
1. PDF is scanned (image-based) - Needs OCR
2. PDF is encrypted
3. PDF has special encoding

**Solution**: Check the `extraction_metadata.hint` field for details. For scanned PDFs, consider adding OCR support.

### Connection Refused Error

**Problem**: Edge Function can't connect to Python service

**Solution**:
1. Verify Python service is running: `curl http://localhost:5000/health`
2. Check `PDF_EXTRACTOR_URL` is correctly set
3. Check firewall settings if deploying to remote server

### File Too Large Error

**Problem**: Upload fails with 413 error

**Solution**: Increase `MAX_FILE_SIZE_MB` in Python service `.env` file

## Testing

### Test the Python Service Directly

```bash
# Health check
curl http://localhost:5000/health

# Extract text from a PDF
curl -X POST http://localhost:5000/extract-text \
  -F "file=@/path/to/resume.pdf"
```

### Test Through the Application

1. Upload a text-based PDF resume
2. Check the extraction status shows "success"
3. View the candidate detail page
4. Expand the "Extracted Text" section
5. Verify text is readable and complete

### Test Edge Cases

1. **Scanned PDF**: Upload a scanned PDF - should show "needs_review"
2. **Empty PDF**: Upload an empty PDF - should show "needs_review" or "failed"
3. **Large PDF**: Upload a large PDF - should process correctly
4. **Corrupted PDF**: Upload a corrupted file - should show "failed"

## Future Enhancements

The architecture supports easy extension:

### OCR Support

Add OCR for scanned PDFs:
1. Install pytesseract or use AWS Textract
2. Update extraction logic to detect image-based PDFs
3. Apply OCR when needed
4. Update `raw_text_source` to indicate OCR was used

### DOC/DOCX Support

Add support for Word documents:
1. Install python-docx or similar
2. Add file type detection
3. Implement text extraction for DOC/DOCX
4. Update allowed file types

### Batch Processing

Add queue-based processing:
1. Implement Redis/RabbitMQ queue
2. Make extraction asynchronous
3. Add status polling endpoint
4. Update UI to show processing status

### Caching

Add caching to avoid re-extraction:
1. Store hash of uploaded file
2. Check cache before extraction
3. Return cached result if available

## Data Flow Example

Here's a complete example of the data flow:

1. **User uploads** `resume.pdf` (50 KB, 2 pages)

2. **Edge Function calls** Python service:
```json
POST http://localhost:5000/extract-text
Content-Type: multipart/form-data
file: [binary PDF data]
```

3. **Python service responds**:
```json
{
  "ok": true,
  "text": "John Doe\nEmail: john@example.com\n...",
  "page_texts": ["John Doe...", "Experience..."],
  "pages": 2,
  "chars": 1523,
  "hint": "Text extracted successfully",
  "status": "success"
}
```

4. **Edge Function saves** to database:
```sql
UPDATE candidates SET
  raw_text = 'John Doe\nEmail: john@example.com\n...',
  extraction_status = 'success',
  extraction_metadata = '{"pages": 2, "chars": 1523, "hint": "...", "extracted_at": "2024-..."}'
  raw_text_source = 'pymupdf'
WHERE id = '...';
```

5. **UI displays** in Candidate Detail:
- Green "success" badge
- "Pages: 2, Characters: 1523, Source: pymupdf"
- Collapsible text view with copy button

## Support

For issues or questions:

1. Check the logs:
   - Python service: Terminal where `python app.py` is running
   - Edge Function: Supabase Dashboard → Edge Functions → Logs
   - Frontend: Browser console

2. Review the troubleshooting section above

3. Check the detailed README files:
   - `pdf-extractor/README.md` - Python service details
   - `README.md` - Main application details

## Summary

The PDF extraction feature provides:
- ✅ Reliable text extraction from text-based PDFs
- ✅ Clear status indication for manual review cases
- ✅ Easy-to-use UI with collapsible text view
- ✅ Extensible architecture for future enhancements
- ✅ Security best practices
- ✅ Simple local development setup
- ✅ Production-ready deployment options

The system is now ready to extract and display text from PDF resumes for AI-powered screening and scoring.
