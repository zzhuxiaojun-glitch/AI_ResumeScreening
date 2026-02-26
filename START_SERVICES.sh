#!/bin/bash

# AI Resume Screening ATS - Start All Services
# This script starts both the Python PDF extraction service and the main web application

echo "================================"
echo "AI Resume Screening ATS Startup"
echo "================================"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 16 or higher"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"
echo "✅ Node.js found: $(node --version)"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $PYTHON_PID $NODE_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Python PDF Extraction Service
echo "📦 Starting PDF Extraction Service..."
cd pdf-extractor

if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

if [ ! -f "venv/installed" ]; then
    echo "   Installing Python dependencies..."
    pip install -r requirements.txt > /dev/null 2>&1
    touch venv/installed
fi

if [ ! -f ".env" ]; then
    echo "   Creating .env file..."
    cp .env.example .env
fi

echo "   Starting service on http://localhost:5000"
python app.py > ../logs/pdf-extractor.log 2>&1 &
PYTHON_PID=$!

cd ..

# Wait for Python service to be ready
echo "   Waiting for service to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo "✅ PDF Extraction Service is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Error: PDF Extraction Service failed to start"
        echo "Check logs/pdf-extractor.log for details"
        kill $PYTHON_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done

echo ""

# Start Main Web Application
echo "🚀 Starting Web Application..."

if [ ! -d "node_modules" ]; then
    echo "   Installing Node dependencies..."
    npm install > logs/npm-install.log 2>&1
fi

echo "   Starting development server on http://localhost:5173"
npm run dev > logs/vite.log 2>&1 &
NODE_PID=$!

# Wait for Vite to be ready
echo "   Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ Web Application is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Error: Web Application failed to start"
        echo "Check logs/vite.log for details"
        cleanup
        exit 1
    fi
    sleep 1
done

echo ""
echo "================================"
echo "✅ All Services Started!"
echo "================================"
echo ""
echo "📋 Service URLs:"
echo "   • Web App:          http://localhost:5173"
echo "   • PDF Extractor:    http://localhost:5000"
echo ""
echo "📝 Logs:"
echo "   • PDF Extractor:    logs/pdf-extractor.log"
echo "   • Web Application:  logs/vite.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep the script running
wait
