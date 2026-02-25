# Project Structure Overview

## Directory Layout

```
ai-resume-screening-system/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── LoginPage.tsx        # Login/signup page
│   │   ├── Layout.tsx           # Main layout with navigation
│   │   ├── PositionsPage.tsx    # Position management (CRUD)
│   │   ├── UploadPage.tsx       # Resume upload interface
│   │   ├── EmailConfigPage.tsx  # Email import configuration
│   │   ├── CandidatesPage.tsx   # Candidate list with filters
│   │   └── CandidateDetailPage.tsx  # Detailed candidate view
│   ├── contexts/                # React contexts
│   │   └── AuthContext.tsx      # Authentication state
│   ├── lib/                     # Utilities and configs
│   │   └── supabase.ts          # Supabase client + TypeScript types
│   ├── App.tsx                  # Main application component
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles (Tailwind)
├── supabase/                    # Supabase backend
│   └── functions/               # Edge Functions (serverless)
│       ├── parse-resume/        # Resume parsing logic
│       │   └── index.ts         # Text extraction + scoring
│       └── import-emails/       # Email import logic
│           └── index.ts         # IMAP integration (mock)
├── public/                      # Static assets
├── dist/                        # Build output
├── README.md                    # Main documentation
├── SETUP.md                     # Quick start guide
├── SAMPLE_DATA.md              # Test data examples
├── PROJECT_STRUCTURE.md         # This file
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript config
├── tailwind.config.js          # Tailwind CSS config
├── vite.config.ts              # Vite bundler config
└── .env                        # Environment variables (Supabase)
```

## Component Architecture

```
App (AuthProvider)
├── LoginPage                    # When not authenticated
└── Layout                       # When authenticated
    ├── Header (Navigation)
    ├── Main Content Area
    │   ├── CandidatesPage       # Default view
    │   │   └── Filter + List → CandidateDetailPage
    │   ├── PositionsPage        # Position CRUD
    │   ├── UploadPage          # File upload
    │   └── EmailConfigPage     # Email settings
    └── Footer (implicit)
```

## Data Flow

### 1. Authentication Flow
```
User Input → AuthContext → Supabase Auth
                ↓
          Session State
                ↓
    LoginPage ←→ Main App
```

### 2. Resume Upload Flow
```
User Upload → UploadPage
                ↓
        Supabase Storage
                ↓
        Create Resume Record
                ↓
    Trigger parse-resume Edge Function
                ↓
        Extract Information
                ↓
        Calculate Score
                ↓
    Create Candidate + Score Records
                ↓
        Display in CandidatesPage
```

### 3. Email Import Flow
```
User Config → EmailConfigPage
                ↓
        Save IMAP Settings
                ↓
    Trigger import-emails Edge Function
                ↓
        Fetch Emails (Mock)
                ↓
        Extract Attachments
                ↓
        Upload to Storage
                ↓
    Trigger parse-resume for Each
                ↓
        Display in CandidatesPage
```

### 4. Scoring Flow
```
Position Rules (Must/Nice/Reject)
                +
Candidate Skills (Extracted)
                ↓
        Match Skills
                ↓
    Calculate Scores:
    - Must Score (weight × 10)
    - Nice Score (weight × 5)
    - Reject Penalty (-15 each)
                ↓
    Total = Must + Nice - Penalty
                ↓
    Assign Grade (A/B/C/D)
                ↓
        Generate Explanation
```

## Database Schema

```
positions                    resumes                     candidates
├── id (uuid)               ├── id (uuid)               ├── id (uuid)
├── title                   ├── position_id (fk)        ├── resume_id (fk)
├── description             ├── file_name               ├── position_id (fk)
├── must_skills (jsonb)     ├── file_path               ├── name
├── nice_skills (jsonb)     ├── file_size               ├── email
├── reject_keywords         ├── file_type               ├── phone
├── grade_thresholds        ├── upload_source           ├── education
├── status                  ├── status                  ├── school
├── created_at              └── created_at              ├── skills (jsonb)
└── updated_at                                          ├── projects (jsonb)
                                                        ├── highlights (jsonb)
scores                      email_configs               ├── risks (jsonb)
├── id (uuid)               ├── id (uuid)               ├── current_status
├── candidate_id (fk)       ├── position_id (fk)        ├── notes
├── total_score             ├── server                  ├── created_at
├── grade (A/B/C/D)         ├── port                    └── updated_at
├── must_score              ├── email
├── nice_score              ├── password
├── reject_penalty          ├── folder
├── matched_must (jsonb)    ├── search_keywords
├── matched_nice (jsonb)    ├── last_sync_at
├── matched_reject          ├── is_active
├── missing_must (jsonb)    └── created_at
├── explanation
└── created_at
```

## Key Technologies

### Frontend Stack
- **React 18**: UI framework with hooks
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first CSS
- **Vite**: Fast build tool
- **Lucide React**: Icon library

### Backend Stack
- **Supabase**: Backend-as-a-Service
  - PostgreSQL: Relational database
  - Edge Functions: Serverless functions
  - Storage: File storage
  - Auth: User authentication
- **Deno**: Edge Functions runtime

### Development Tools
- **ESLint**: Code linting
- **TypeScript**: Type checking
- **PostCSS**: CSS processing
- **npm**: Package management

## Code Conventions

### TypeScript Types
- Interfaces for data models in `src/lib/supabase.ts`
- Type-safe function parameters and returns
- Strict null checking enabled

### Component Structure
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { supabase, Type } from '../lib/supabase';

// 2. Props interface
interface ComponentProps {
  prop1: string;
  prop2: number;
}

// 3. Component
export function Component({ prop1, prop2 }: ComponentProps) {
  // 4. State
  const [data, setData] = useState<Type[]>([]);

  // 5. Effects
  useEffect(() => {
    loadData();
  }, []);

  // 6. Handlers
  const handleAction = async () => {
    // ...
  };

  // 7. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Styling Patterns
- Tailwind utility classes for styling
- Consistent color scheme:
  - Primary: Blue (blue-600)
  - Success: Green (green-600)
  - Warning: Yellow/Orange (yellow-600)
  - Danger: Red (red-600)
  - Neutral: Slate (slate-600)
- Responsive breakpoints: sm, md, lg
- Consistent spacing: p-4, p-6, gap-4, space-y-4

### State Management
- React Context for global auth state
- Local state for component-specific data
- No external state management library (kept simple)

## Edge Function Patterns

### Standard Structure
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Main handler
Deno.serve(async (req: Request) => {
  // Handle OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Setup Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Business logic
    const result = await doSomething();

    // Return success
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // Return error
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Auto-available in Edge Functions:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
```

## Build & Deployment

### Development
```bash
npm run dev          # Start dev server (auto-runs)
npm run typecheck    # Check TypeScript
npm run lint         # Run ESLint
```

### Production
```bash
npm run build        # Build for production
npm run preview      # Preview production build
```

### Edge Functions
Edge functions are already deployed via Supabase MCP tools.

## Security Considerations

### Row Level Security (RLS)
- All tables have RLS enabled
- Policies restrict access to authenticated users
- Storage bucket is private

### Authentication
- Email/password authentication via Supabase Auth
- Session management handled automatically
- Protected routes in frontend

### Data Validation
- TypeScript for compile-time checks
- Database constraints for data integrity
- Input sanitization in forms

## Performance Optimizations

### Frontend
- Code splitting via Vite
- Lazy loading of components (can be added)
- Optimized bundle size (~327KB)

### Backend
- Database indexes on foreign keys and status fields
- Efficient queries with proper joins
- Storage for file offloading

### Future Optimizations
- Pagination for large lists
- Caching with React Query
- Virtual scrolling for long lists
- Image optimization for resumes

## Testing Strategy

### Current Testing
- Manual testing via UI
- Sample data validation
- Build verification

### Recommended Testing
```typescript
// Unit tests (Vitest)
- Component rendering
- Utility functions
- Scoring algorithm

// Integration tests
- API calls
- Database operations
- File uploads

// E2E tests (Playwright)
- User workflows
- Form submissions
- Data flows
```

## Extending the System

### Add New Features

1. **New Component**
   - Create in `src/components/`
   - Add route in `App.tsx`
   - Add navigation in `Layout.tsx`

2. **New Database Table**
   - Create migration in Supabase
   - Add TypeScript types in `supabase.ts`
   - Create RLS policies

3. **New Edge Function**
   - Create in `supabase/functions/[name]/`
   - Deploy via Supabase tools
   - Call from frontend

### Customization Points

1. **Scoring Algorithm**
   - Edit `parse-resume/index.ts` → `calculateScore()`
   - Adjust weights and penalties
   - Add new scoring criteria

2. **Parsing Logic**
   - Edit `parse-resume/index.ts` → `extractInformation()`
   - Add new regex patterns
   - Integrate AI/OCR services

3. **UI Styling**
   - Modify Tailwind classes
   - Update `tailwind.config.js` for theme
   - Add custom CSS in `index.css`

## Troubleshooting Guide

### Common Issues

**Build Errors**
- Check TypeScript errors: `npm run typecheck`
- Clear cache: `rm -rf node_modules dist && npm install`
- Verify imports and exports

**Database Issues**
- Check RLS policies in Supabase dashboard
- Verify foreign key constraints
- Check table permissions

**Storage Issues**
- Verify bucket exists and is accessible
- Check storage policies
- Ensure file paths are correct

**Edge Function Errors**
- Check function logs in Supabase dashboard
- Verify environment variables
- Test with curl/Postman

## Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [TypeScript Docs](https://www.typescriptlang.org)
- [Vite Docs](https://vitejs.dev)
