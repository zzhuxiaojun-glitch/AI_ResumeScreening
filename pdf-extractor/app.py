"""
PDF Text Extraction Microservice

This service extracts text from PDF resumes using PyMuPDF (fitz).
It provides a simple HTTP API that returns extracted text and metadata.

Environment Variables:
- PORT: Server port (default: 5000)
- MAX_FILE_SIZE_MB: Maximum file size in MB (default: 10)
- MIN_TEXT_LENGTH: Minimum text length to consider successful (default: 100)
"""

import os
import fitz  # PyMuPDF
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import tempfile
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configuration
MAX_FILE_SIZE_MB = int(os.getenv('MAX_FILE_SIZE_MB', '10'))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MIN_TEXT_LENGTH = int(os.getenv('MIN_TEXT_LENGTH', '100'))
ALLOWED_EXTENSIONS = {'pdf'}

app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE_BYTES


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text_from_pdf(pdf_path):
    """
    Extract text from PDF using PyMuPDF

    Returns:
        dict: {
            'ok': bool,
            'text': str (combined text from all pages),
            'page_texts': list (text per page),
            'pages': int,
            'chars': int,
            'hint': str (status hint),
            'status': str (success/needs_review/failed)
        }
    """
    try:
        # Open PDF
        doc = fitz.open(pdf_path)

        page_texts = []
        total_chars = 0

        # Extract text from each page
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            page_texts.append(text)
            total_chars += len(text.strip())

        doc.close()

        # Combine all page texts
        combined_text = '\n\n'.join(page_texts)

        # Determine status based on text length
        if total_chars == 0:
            status = 'needs_review'
            hint = 'No text extracted - possibly a scanned image or encrypted PDF'
        elif total_chars < MIN_TEXT_LENGTH:
            status = 'needs_review'
            hint = f'Very short text extracted ({total_chars} chars) - may be scanned or have special encoding'
        else:
            status = 'success'
            hint = 'Text extracted successfully'

        return {
            'ok': status == 'success',
            'text': combined_text,
            'page_texts': page_texts,
            'pages': len(doc),
            'chars': total_chars,
            'hint': hint,
            'status': status
        }

    except fitz.FileDataError as e:
        logger.error(f'Invalid PDF file: {str(e)}')
        return {
            'ok': False,
            'text': '',
            'page_texts': [],
            'pages': 0,
            'chars': 0,
            'hint': f'Invalid or corrupted PDF file',
            'status': 'failed'
        }
    except Exception as e:
        logger.error(f'Error extracting text: {str(e)}')
        return {
            'ok': False,
            'text': '',
            'page_texts': [],
            'pages': 0,
            'chars': 0,
            'hint': f'Extraction error: {type(e).__name__}',
            'status': 'failed'
        }


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'pdf-text-extractor',
        'version': '1.0.0'
    })


@app.route('/extract-text', methods=['POST'])
def extract_text():
    """
    Extract text from uploaded PDF file

    Expected request:
    - multipart/form-data with 'file' field containing PDF

    Returns:
    - JSON with extraction results
    """

    # Validate request has file
    if 'file' not in request.files:
        return jsonify({
            'ok': False,
            'error': 'No file provided',
            'status': 'failed'
        }), 400

    file = request.files['file']

    # Validate filename
    if file.filename == '':
        return jsonify({
            'ok': False,
            'error': 'No file selected',
            'status': 'failed'
        }), 400

    # Validate file type
    if not allowed_file(file.filename):
        return jsonify({
            'ok': False,
            'error': 'Only PDF files are allowed',
            'status': 'failed'
        }), 400

    # Save to temporary file and process
    try:
        # Create temp file with secure name
        filename = secure_filename(file.filename)

        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_path = temp_file.name
            file.save(temp_path)

        # Extract text
        logger.info(f'Processing PDF: {filename} (size: {os.path.getsize(temp_path)} bytes)')
        result = extract_text_from_pdf(temp_path)

        # Log summary (without full text to avoid logging sensitive data)
        logger.info(f'Extraction result - Status: {result["status"]}, Pages: {result["pages"]}, Chars: {result["chars"]}')

        # Clean up temp file
        os.unlink(temp_path)

        return jsonify(result)

    except Exception as e:
        logger.error(f'Unexpected error: {str(e)}')
        return jsonify({
            'ok': False,
            'error': 'Internal server error',
            'status': 'failed'
        }), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    return jsonify({
        'ok': False,
        'error': f'File too large. Maximum size: {MAX_FILE_SIZE_MB}MB',
        'status': 'failed'
    }), 413


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5000'))
    debug = os.getenv('FLASK_ENV') == 'development'

    logger.info(f'Starting PDF Text Extractor on port {port}')
    logger.info(f'Max file size: {MAX_FILE_SIZE_MB}MB')
    logger.info(f'Min text length: {MIN_TEXT_LENGTH} chars')

    app.run(host='0.0.0.0', port=port, debug=debug)
