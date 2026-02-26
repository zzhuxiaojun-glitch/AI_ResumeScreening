#!/usr/bin/env python3
"""
Quick test script for the PDF extraction service

This script tests the PDF extraction service by creating a simple test PDF
and verifying the extraction works correctly.
"""

import os
import sys
from io import BytesIO
import fitz  # PyMuPDF

def create_test_pdf():
    """Create a simple test PDF with sample resume text"""
    doc = fitz.open()
    page = doc.new_page()

    # Add sample resume text
    text = """
    John Doe
    Email: john.doe@example.com
    Phone: +1-555-0123

    EDUCATION
    Bachelor of Science in Computer Science
    MIT University, 2020

    EXPERIENCE
    Senior Software Engineer
    Tech Company, 2020-Present

    - Developed web applications using React and TypeScript
    - Implemented backend services with Node.js and Python
    - Worked with Docker and Kubernetes for deployment

    SKILLS
    React, TypeScript, Python, Node.js, Docker, Kubernetes, AWS, PostgreSQL
    """

    # Insert text
    page.insert_text((50, 50), text, fontsize=11)

    # Save to BytesIO
    pdf_bytes = BytesIO()
    doc.save(pdf_bytes)
    doc.close()

    pdf_bytes.seek(0)
    return pdf_bytes.read()

def test_local_extraction():
    """Test PDF extraction locally without HTTP"""
    print("Testing local PDF extraction...")

    # Create test PDF
    pdf_data = create_test_pdf()

    # Save temporarily
    test_file = "test_resume.pdf"
    with open(test_file, "wb") as f:
        f.write(pdf_data)

    try:
        # Extract text
        doc = fitz.open(test_file)
        page_texts = []
        total_chars = 0

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            page_texts.append(text)
            total_chars += len(text.strip())

        doc.close()

        combined_text = '\n\n'.join(page_texts)

        print(f"✅ Extraction successful!")
        print(f"   Pages: {len(page_texts)}")
        print(f"   Characters: {total_chars}")
        print(f"\n📄 Extracted text preview:")
        print("-" * 60)
        print(combined_text[:300] + "..." if len(combined_text) > 300 else combined_text)
        print("-" * 60)

        # Verify expected content
        expected_keywords = ["John Doe", "MIT", "React", "TypeScript", "Python"]
        found_keywords = [kw for kw in expected_keywords if kw in combined_text]

        print(f"\n✅ Found {len(found_keywords)}/{len(expected_keywords)} expected keywords")

        if len(found_keywords) == len(expected_keywords):
            print("✅ All tests passed!")
            return True
        else:
            print("⚠️ Some keywords missing")
            return False

    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        # Cleanup
        if os.path.exists(test_file):
            os.remove(test_file)

def test_http_service():
    """Test the HTTP service if running"""
    try:
        import requests

        print("\nTesting HTTP service at http://localhost:5000...")

        # Test health endpoint
        response = requests.get("http://localhost:5000/health", timeout=2)

        if response.status_code == 200:
            print("✅ Service is running")

            # Create test PDF
            pdf_data = create_test_pdf()

            # Test extraction endpoint
            files = {'file': ('test.pdf', BytesIO(pdf_data), 'application/pdf')}
            response = requests.post("http://localhost:5000/extract-text", files=files, timeout=10)

            if response.status_code == 200:
                result = response.json()
                print(f"✅ Extraction via HTTP successful!")
                print(f"   Status: {result.get('status')}")
                print(f"   Pages: {result.get('pages')}")
                print(f"   Characters: {result.get('chars')}")
                print(f"   Hint: {result.get('hint')}")
                return True
            else:
                print(f"❌ HTTP extraction failed: {response.status_code}")
                return False
        else:
            print(f"❌ Service returned status {response.status_code}")
            return False

    except ImportError:
        print("⚠️ 'requests' library not installed - skipping HTTP test")
        print("   Run: pip install requests")
        return None
    except Exception as e:
        print(f"⚠️ Service not running: {e}")
        print("   Start the service with: python app.py")
        return None

if __name__ == "__main__":
    print("=" * 60)
    print("PDF Extraction Service Test")
    print("=" * 60)
    print()

    # Test local extraction
    local_success = test_local_extraction()

    # Test HTTP service if available
    http_result = test_http_service()

    print()
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"Local extraction: {'✅ PASS' if local_success else '❌ FAIL'}")
    if http_result is not None:
        print(f"HTTP service:     {'✅ PASS' if http_result else '❌ FAIL'}")
    else:
        print(f"HTTP service:     ⚠️ SKIPPED")
    print()

    sys.exit(0 if local_success else 1)
