# AI Resume Screening System (ATS)

A full-featured AI-powered resume screening and candidate management system built with React, Supabase, and TypeScript.

## Features

### Core Functionality
- **Position Management**: Create and manage job positions with customizable scoring rules
- **Resume Upload**: Batch upload resumes (PDF, DOC, DOCX) with automatic parsing
- **PDF Text Extraction**: Python-powered text extraction using PyMuPDF for accurate parsing
- **Email Import**: Configure IMAP email to automatically import resumes from your inbox
- **AI Parsing**: Automatic extraction of candidate information (name, contact, education, skills, etc.)
- **Smart Scoring**: Rule-based scoring with must-have/nice-to-have skills and reject keywords
- **Grade System**: Automatic A/B/C/D grading based on customizable thresholds
- **Candidate Management**: Filter, search, and manage candidates with detailed views
- **Extraction Status Tracking**: Visual indicators for extraction success/review needs
- **Raw Text View**: Collapsible view of extracted text with copy functionality
- **CSV Export**: Export filtered candidate lists to CSV for further analysis

### Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **PDF Extraction**: Python + PyMuPDF (Flask microservice)
- **Authentication**: Supabase Auth (Email/Password)
- **Storage**: Supabase Storage for resume files
- **Icons**: Lucide React

## Quick Start

### Automated Startup (Recommended)

For the easiest setup, use the startup script that starts all services:

**Linux/Mac:**
```bash
./START_SERVICES.sh
```

**Windows:**
```bash
START_SERVICES.bat
```

This will automatically:
1. Start the PDF extraction service (Python)
2. Start the web application (Node.js)
3. Open the application in your browser

### Manual Setup

If you prefer to start services individually:

### 1. Installation

```bash
npm install
```

### 2. Environment Setup

Your `.env` file is already configured with Supabase credentials.

### 3. Start PDF Extraction Service

```bash
cd pdf-extractor
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The service will start on `http://localhost:5000`

### 4. Start Web Application

In a new terminal:
```bash
npm run dev
```

### 5. Database Setup

The database schema has been automatically created with the following tables:
- `positions` - Job positions and scoring rules
- `resumes` - Uploaded resume files metadata
- `candidates` - Parsed candidate information with PDF extraction data
- `scores` - Candidate scoring results
- `email_configs` - Email import configurations
- `candidate_resubmissions` - Resubmission tracking

### 6. Authentication Setup

**First-time users need to create an account:**

1. Start the development server (it starts automatically)
2. Open the app in your browser
3. Click "Don't have an account? Sign up"
4. Enter your email and password
5. Click "Sign Up"
6. You'll be automatically logged in

### 7. Run the Application

The development server is already running. Access it at the URL shown in your terminal.

## PDF Text Extraction

The system uses a Python microservice to extract text from PDF resumes. See [PDF_EXTRACTION_SETUP.md](./PDF_EXTRACTION_SETUP.md) for:
- Architecture overview
- Detailed setup instructions
- Configuration options
- Troubleshooting guide
- Deployment options

### Key Features
- Fast text extraction using PyMuPDF
- Automatic detection of scanned PDFs
- Status tracking (`success`, `needs_review`, `failed`)
- Extraction metadata (pages, characters, hints)
- Collapsible raw text view in UI
- Copy to clipboard functionality

## Usage Guide

### Step 1: Create a Position

1. Navigate to "Positions" tab
2. Click "New Position"
3. Fill in the details:
   - **Position Title**: e.g., "Senior Frontend Developer"
   - **Job Description**: Brief description of the role
   - **Must-Have Skills**: One skill per line with weight
     ```
     React: 3
     TypeScript: 2
     Node.js: 2
     ```
   - **Nice-to-Have Skills**: Bonus skills with weights
     ```
     Docker: 1
     AWS: 1
     ```
   - **Reject Keywords**: Auto-reject criteria (one per line)
     ```
     在校生
     实习
     ```
   - **Grade Thresholds**: Set score thresholds for A/B/C/D grades
     - Grade A: ≥80
     - Grade B: ≥60
     - Grade C: ≥40
     - Grade D: <40

4. Click "Create"

### Step 2: Upload Resumes

**Option A: Manual Upload**
1. Navigate to "Upload Resumes" tab
2. Select the target position
3. Click to upload or drag & drop files
4. Click "Upload & Parse"
5. Wait for processing to complete

**Option B: Email Import**
1. Navigate to "Email Import" tab
2. Click "Add Email Configuration"
3. Configure your email:
   - **IMAP Server**: e.g., `imap.gmail.com`
   - **Port**: `993` (default for SSL)
   - **Email**: Your email address
   - **Password**: App password (for Gmail)
   - **Folder**: `INBOX` (or custom folder)
   - **Keywords**: Optional filter (e.g., "resume, cv")
4. Click "Save Configuration"
5. Click "Import Latest Resumes" to fetch from email

**Gmail Setup:**
1. Enable IMAP: Settings → Forwarding and POP/IMAP
2. Create App Password: Google Account → Security → 2-Step Verification → App passwords
3. Use the generated app password instead of your regular password

### Step 3: Review Candidates

1. Navigate to "Candidates" tab
2. Use filters to narrow down:
   - Search by name, email, phone, or skills
   - Filter by position, grade, or status
   - Sort by score or date
3. Click "View" on any candidate to see details

### Step 4: Candidate Details

In the detail view, you can:
- See complete candidate information
- View scoring breakdown and explanation
- Download original resume
- Update candidate status (New → Reviewed → Interview → Rejected/Hired)
- Add notes for internal team discussion
- See matched/missing skills with visual indicators

### Step 5: Export Results

1. Apply filters on the Candidates page
2. Click "Export CSV"
3. Opens/downloads a CSV file with all filtered candidates

## Scoring System

### How Scoring Works

The system calculates scores based on three components:

1. **Must-Have Skills Score** (0-100 points)
   - Each matched must-have skill: `weight × 10` points
   - Missing must-have skills result in 0 points for those skills

2. **Nice-to-Have Skills Score** (bonus points)
   - Each matched nice-to-have skill: `weight × 5` points

3. **Reject Penalty** (deduction)
   - Each reject keyword found: `-15` points

**Total Score Formula:**
```
Total = min(100, max(0, Must_Score + Nice_Score - Reject_Penalty))
```

### Grade Assignment

Based on your configured thresholds:
- **Grade A**: Score ≥ threshold_A (default: 80)
- **Grade B**: Score ≥ threshold_B (default: 60)
- **Grade C**: Score ≥ threshold_C (default: 40)
- **Grade D**: Score < threshold_C

### Explanation

Each candidate gets a detailed explanation showing:
- Matched must-have skills
- Missing must-have skills
- Matched nice-to-have skills
- Reject keywords found (if any)
- Score breakdown by category

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── LoginPage.tsx           # Authentication
│   │   ├── Layout.tsx              # Main layout wrapper
│   │   ├── PositionsPage.tsx       # Position management
│   │   ├── UploadPage.tsx          # Resume upload
│   │   ├── EmailConfigPage.tsx     # Email import config
│   │   ├── CandidatesPage.tsx      # Candidate list
│   │   └── CandidateDetailPage.tsx # Candidate details
│   ├── contexts/
│   │   └── AuthContext.tsx         # Auth state management
│   ├── lib/
│   │   └── supabase.ts             # Supabase client & types
│   ├── App.tsx                     # Main app component
│   └── main.tsx                    # App entry point
├── supabase/
│   └── functions/
│       ├── parse-resume/           # Resume parsing edge function
│       └── import-emails/          # Email import edge function
└── README.md
```

## Edge Functions

### parse-resume
Handles resume file processing:
1. Downloads resume from storage
2. Extracts text content
3. Parses candidate information using regex patterns
4. Calculates score based on position requirements
5. Stores candidate and score in database

### import-emails
Handles email import:
1. Fetches emails from configured IMAP server
2. Extracts resume attachments
3. Uploads to storage
4. Triggers parse-resume for each file

**Note**: The current implementation uses mock data for demonstration. For production, integrate with actual IMAP libraries.

## Database Schema

### positions
- Job position details
- Scoring rules (must/nice/reject)
- Grade thresholds

### resumes
- Uploaded file metadata
- Storage path reference
- Upload source tracking

### candidates
- Parsed candidate information
- Contact details
- Education & experience
- Skills & projects
- Status tracking

### scores
- Calculated scores
- Grade assignment
- Detailed scoring breakdown
- Match/miss analysis

### email_configs
- IMAP server settings
- Email credentials
- Sync tracking

## Mock Test Data

Here are sample resume texts you can use for testing:

### Sample 1: Senior Developer (Should score A)
```
姓名：张三
邮箱：zhangsan@example.com
电话：13800138000
学历：硕士
学校：清华大学计算机学院
专业：计算机科学与技术
毕业时间：2020年6月
工作经验：5年工作经验

技能：
React、TypeScript、Node.js、Python、Docker、AWS、MySQL、Redis、Kubernetes

项目经验：
项目：电商平台前端开发，负责整体前端架构设计，使用React和TypeScript构建高性能单页应用
项目：微服务系统后端开发，使用Node.js和Docker构建高可用服务，部署在AWS云平台
项目：数据分析平台，使用Python进行大数据处理和可视化展示
```

### Sample 2: Mid-level Developer (Should score B)
```
姓名：李四
邮箱：lisi@example.com
电话：13900139000
学历：本科
学校：北京大学软件学院
专业：软件工程
毕业时间：2021年7月
工作经验：2年工作经验

技能：
Vue、JavaScript、Node.js、MySQL、Git、Linux

项目经验：
项目：企业管理系统，负责前端页面开发和API对接
项目：移动端H5应用开发，使用Vue框架开发响应式页面
```

### Sample 3: Junior Developer (Should score C/D)
```
姓名：王五
邮箱：wangwu@example.com
电话：13700137000
学历：本科
学校：上海交通大学
专业：软件工程
毕业时间：2023年6月
工作经验：应届毕业生

技能：
HTML、CSS、JavaScript、Git

项目经验：
项目：个人博客网站开发
项目：学校课程管理系统（课程项目）
```

## Customization

### Adjust Scoring Weights
Edit position settings to change skill weights:
- Higher weight = more important skill
- Must-have skills: 10 points per weight unit
- Nice-to-have skills: 5 points per weight unit

### Modify Grade Thresholds
Adjust thresholds in position settings:
- More strict: Increase thresholds (e.g., A≥90, B≥75)
- More lenient: Decrease thresholds (e.g., A≥70, B≥50)

### Add More Parsing Rules
Edit `supabase/functions/parse-resume/index.ts`:
- Add regex patterns for new fields
- Modify skill extraction logic
- Enhance scoring algorithm

## Troubleshooting

### Build Errors
```bash
npm run build
```
If errors occur, check console for specific TypeScript errors.

### Authentication Issues
- Make sure you've signed up first
- Check browser console for errors
- Verify Supabase credentials in `.env`

### Upload Failures
- Check file size (max recommended: 10MB)
- Verify file format (PDF, DOC, DOCX)
- Check browser console for storage errors

### Email Import Not Working
- Verify IMAP settings are correct
- For Gmail, use App Password, not regular password
- Check that IMAP is enabled in email settings

## Future Enhancements

Potential improvements for production:
- Real IMAP integration (replace mock data)
- OCR for scanned PDFs (Tesseract.js or cloud OCR)
- AI-powered parsing (OpenAI GPT-4, Claude)
- Real-time candidate ranking
- Email notifications for new candidates
- Interview scheduling integration
- Multi-language support
- Advanced analytics dashboard
- Candidate pipeline visualization

## License

MIT License - free for personal and commercial use.
