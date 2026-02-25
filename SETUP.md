# Quick Setup Guide

## 1. First Time Setup (30 seconds)

1. **Create Account**
   - App is already running
   - Click "Sign up"
   - Enter email: `admin@test.com`
   - Enter password: `password123`
   - Click "Sign Up"

2. **Create Your First Position**
   - Click "Positions" tab
   - Click "New Position"
   - Copy-paste this example:

```
Title: Senior Frontend Developer

Must-Have Skills:
React: 3
TypeScript: 2
Node.js: 2

Nice-to-Have Skills:
Docker: 1
AWS: 1
GraphQL: 1

Reject Keywords:
在校生
实习生

Grade Thresholds:
A: 80
B: 60
C: 40
```

3. **Test with Mock Data**
   - Click "Email Import" tab
   - Fill in any dummy email config
   - Click "Save Configuration"
   - Click "Import Latest Resumes"
   - Wait 5-10 seconds
   - Navigate to "Candidates" tab
   - You should see 2 parsed candidates!

## 2. Manual Upload Test

Create a text file named `test-resume.txt` with this content:

```
姓名：测试候选人
邮箱：test@example.com
电话：13800138000
学历：硕士
学校：清华大学
专业：计算机科学
毕业时间：2020年6月
工作经验：5年

技能：React TypeScript Node.js Docker AWS MySQL Redis Python

项目经验：
项目：电商平台开发，使用React和TypeScript构建前端应用
项目：微服务后端，使用Node.js开发RESTful API
```

Then:
1. Go to "Upload Resumes" tab
2. Select your position
3. Upload the `test-resume.txt` file
4. Click "Upload & Parse"
5. Check "Candidates" tab

## 3. Understanding the Scoring

For the position with Must-Have: React(3), TypeScript(2), Node.js(2)

**High Score Example** (Grade A, ~70+ points):
- Has React ✓ → 30 points
- Has TypeScript ✓ → 20 points
- Has Node.js ✓ → 20 points
- Has Docker ✓ → 5 bonus points
- **Total: 75 points = Grade A**

**Medium Score Example** (Grade B, ~40-60 points):
- Has React ✓ → 30 points
- Missing TypeScript ✗ → 0 points
- Has Node.js ✓ → 20 points
- **Total: 50 points = Grade B**

**Low Score Example** (Grade D, <40 points):
- Missing React ✗ → 0 points
- Missing TypeScript ✗ → 0 points
- Has Node.js ✓ → 20 points
- **Total: 20 points = Grade D**

## 4. Complete Workflow Example

### Scenario: Hiring a Frontend Developer

**Step 1: Define Requirements**
```
Position: Frontend Developer
Must-Have: React(3), JavaScript(2), CSS(1)
Nice-to-Have: TypeScript(2), Redux(1), Webpack(1)
Reject: 在校生, 培训班
Thresholds: A≥80, B≥60, C≥40
```

**Step 2: Import Resumes**
- Use Email Import or Manual Upload
- System automatically parses all resumes

**Step 3: Review Candidates**
- Filter: Grade A or B only
- Sort: By score (highest first)
- Review top 5 candidates

**Step 4: Detail Analysis**
For each candidate:
- Check matched/missing skills
- Read highlights and risks
- Review original resume
- Add notes

**Step 5: Update Status**
- Move promising candidates to "Interview"
- Reject candidates with critical missing skills
- Export filtered list for team review

## 5. Production Deployment Notes

Before deploying to production:

1. **Security**
   - Change default passwords
   - Review RLS policies
   - Enable email confirmation
   - Set up proper CORS

2. **Email Import**
   - Replace mock data with real IMAP client
   - Consider using `npm:imap-simple` or similar
   - Add error handling and retry logic

3. **Resume Parsing**
   - Integrate OCR for scanned PDFs (Tesseract.js)
   - Consider AI parsing (OpenAI, Claude API)
   - Add support for more document formats

4. **Storage**
   - Set up file size limits
   - Configure automatic cleanup
   - Add virus scanning

5. **Performance**
   - Add pagination for large candidate lists
   - Implement caching
   - Optimize database queries
   - Consider CDN for resume files

## 6. Troubleshooting

**Q: Can't see uploaded resumes?**
- Check "Candidates" tab, not "Upload" tab
- Wait a few seconds for parsing to complete
- Check browser console for errors

**Q: Scoring seems wrong?**
- Review position's must-have/nice-to-have skills
- Check skill weights
- Verify grade thresholds
- Skills are case-insensitive matched

**Q: Email import not working?**
- Current version uses mock data (2 test resumes)
- For real IMAP, need to implement actual IMAP client
- Check edge function logs in Supabase dashboard

**Q: Build fails?**
- Run `npm install` again
- Clear `node_modules` and reinstall
- Check TypeScript errors with `npm run typecheck`

## 7. Testing Checklist

- [ ] Sign up / Sign in works
- [ ] Create position
- [ ] Upload resume (manual)
- [ ] Import from email (mock)
- [ ] View candidate list
- [ ] Filter candidates
- [ ] View candidate detail
- [ ] Update candidate status
- [ ] Add notes
- [ ] Download resume
- [ ] Export CSV
- [ ] Scoring calculation correct
- [ ] Grade assignment correct

## 8. Default Test Credentials

After first setup, use these to test:

**Admin Account**
- Email: `admin@test.com`
- Password: `password123`

**Test Position**
- Title: Senior Frontend Developer
- Must: React, TypeScript, Node.js
- Nice: Docker, AWS
- Reject: 在校生

**Mock Candidates** (from email import)
- Candidate 1: 张三 (High scorer, Grade A)
- Candidate 2: 李四 (Medium scorer, Grade B)

Enjoy your AI Resume Screening System!
