# PDF Text Extraction Microservice

This is a standalone Python microservice that extracts text from PDF resumes using PyMuPDF (fitz). It provides a simple HTTP API for the main ATS application to call.

## Features

- Fast text extraction from text-based PDFs using PyMuPDF
- File size validation and security checks
- Automatic detection of scanned PDFs (needs review)
- Detailed extraction metadata (pages, characters, status)
- Simple REST API interface
- Extensible for future OCR integration

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Installation

1. Navigate to the pdf-extractor directory:
```bash
cd pdf-extractor
```

2. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env if needed
```

## Running the Service

### Development Mode

```bash
python app.py
```

The service will start on `http://localhost:5000` by default.

### Production Mode

Using Gunicorn (recommended for production):

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

Options:
- `-w 4`: Use 4 worker processes
- `-b 0.0.0.0:5000`: Bind to all interfaces on port 5000
- `--timeout 60`: Set timeout for long PDF processing

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "pdf-text-extractor",
  "version": "1.0.0"
}
```

### Extract Text from PDF

```bash
POST /extract-text
Content-Type: multipart/form-data
```

Parameters:
- `file`: PDF file (max 10MB by default)

Response (Success):
```json
{
  "ok": true,
  "text": "Full extracted text...",
  "page_texts": ["Page 1 text...", "Page 2 text..."],
  "pages": 2,
  "chars": 1234,
  "hint": "Text extracted successfully",
  "status": "success"
}
```

Response (Needs Review - Scanned PDF):
```json
{
  "ok": false,
  "text": "",
  "page_texts": [""],
  "pages": 1,
  "chars": 0,
  "hint": "No text extracted - possibly a scanned image or encrypted PDF",
  "status": "needs_review"
}
```

Response (Error):
```json
{
  "ok": false,
  "error": "Invalid or corrupted PDF file",
  "status": "failed"
}
```

## Configuration

Edit `.env` file to configure:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| FLASK_ENV | Environment (development/production) | development |
| MAX_FILE_SIZE_MB | Maximum upload file size in MB | 10 |
| MIN_TEXT_LENGTH | Minimum characters for successful extraction | 100 |

## Testing

Test with curl:

```bash
# Health check
curl http://localhost:5000/health

# Extract text from a PDF
curl -X POST http://localhost:5000/extract-text \
  -F "file=@/path/to/resume.pdf"
```

## Integration with Main Application

Update the main application's `.env` file:

```bash
PDF_EXTRACTOR_URL=http://localhost:5000
```

The Edge Function `parse-resume` will call this service to extract text from uploaded PDFs.

## Security Considerations

1. **File Size Limits**: Configured via `MAX_FILE_SIZE_MB`
2. **File Type Validation**: Only PDF files are accepted
3. **Secure Filenames**: Uses `secure_filename()` to prevent path traversal
4. **Temporary Files**: Files are processed in temp directory and cleaned up
5. **No Logging of Content**: Sensitive resume text is not logged
6. **HTTPS**: Use HTTPS in production (configured at reverse proxy/load balancer)

## Future Enhancements

- [ ] Add OCR support for scanned PDFs (pytesseract/Textract)
- [ ] Support for DOC/DOCX files
- [ ] Batch processing API
- [ ] Async/queue-based processing for large files
- [ ] Authentication/API keys
- [ ] Rate limiting
- [ ] Caching of processed results

## Deployment

### Docker (Recommended for Production)

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "--timeout", "60", "app:app"]
```

Build and run:
```bash
docker build -t pdf-extractor .
docker run -p 5000:5000 -e PORT=5000 pdf-extractor
```

### Deploy to Company Server

1. Copy the `pdf-extractor` directory to your server
2. Install Python 3.8+ and dependencies
3. Configure environment variables
4. Use systemd or supervisor to run as a service
5. Set up nginx/Apache as reverse proxy with HTTPS

Example systemd service file (`/etc/systemd/system/pdf-extractor.service`):

```ini
[Unit]
Description=PDF Text Extraction Service
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/pdf-extractor
Environment="PATH=/opt/pdf-extractor/venv/bin"
ExecStart=/opt/pdf-extractor/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### "No module named 'fitz'"
- Make sure you installed PyMuPDF: `pip install PyMuPDF`
- Check you're using the correct virtual environment

### "File too large" error
- Increase `MAX_FILE_SIZE_MB` in `.env`
- Check your reverse proxy also allows large uploads

### Extraction returns empty text
- The PDF might be scanned (image-based) - consider adding OCR
- The PDF might be encrypted or have special encoding
- Check the `hint` field in the response for details

## License

Part of the AI Resume Screening ATS system.
