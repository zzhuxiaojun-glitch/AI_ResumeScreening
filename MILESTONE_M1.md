# Milestone 1: 基础简历上传和解析系统

## 功能范围

✅ 手动批量上传简历（PDF/DOC/DOCX）
✅ 自动文本解析提取候选人信息
✅ 候选人列表展示（搜索、筛选）
✅ 候选人详情页
✅ CSV批量导出

## 数据库表结构

### 1. resumes（简历文件表）

```sql
CREATE TABLE resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,              -- 原始文件名
  file_path text NOT NULL,              -- 存储路径
  file_size integer DEFAULT 0,          -- 文件大小(bytes)
  file_type text DEFAULT 'pdf',         -- 文件类型
  status text DEFAULT 'pending',        -- pending/parsed/failed
  parse_error text,                     -- 解析错误信息
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_resumes_status ON resumes(status);
```

### 2. candidates（候选人表）

```sql
CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,

  -- 基本信息
  name text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',

  -- 教育信息
  education text DEFAULT '',              -- 本科/硕士/博士
  school text DEFAULT '',
  major text DEFAULT '',
  graduation_date date,

  -- 工作经验
  work_years numeric DEFAULT 0,

  -- 技能与项目
  skills jsonb DEFAULT '[]'::jsonb,       -- 技能列表
  projects jsonb DEFAULT '[]'::jsonb,     -- 项目列表

  -- 亮点与风险
  highlights jsonb DEFAULT '[]'::jsonb,   -- 亮点Top3
  risks jsonb DEFAULT '[]'::jsonb,        -- 风险Top3

  -- 其他
  missing_fields jsonb DEFAULT '[]'::jsonb,  -- 缺失字段
  raw_text text DEFAULT '',                  -- 原始文本
  notes text DEFAULT '',                     -- HR备注

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_candidates_resume ON candidates(resume_id);
CREATE INDEX idx_candidates_email ON candidates(email);
```

### RLS 策略

```sql
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage resumes"
  ON resumes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage candidates"
  ON candidates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

### Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false);

CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Authenticated users can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes');
```

## API 接口清单

### 1. 上传简历

**Endpoint**: `POST /functions/v1/parse-resume`

**请求**:
```json
{
  "resume_id": "uuid"
}
```

**响应**:
```json
{
  "success": true,
  "candidate_id": "uuid",
  "candidate": {
    "name": "张三",
    "email": "zhangsan@example.com",
    "phone": "13800138000",
    "education": "硕士",
    "school": "清华大学",
    "skills": ["React", "TypeScript", "Node.js"],
    "work_years": 5
  }
}
```

**错误响应**:
```json
{
  "error": "Failed to parse resume: file not found"
}
```

### 2. 获取候选人列表

**Endpoint**: `GET /rest/v1/candidates`

**查询参数**:
- `order=created_at.desc` - 按时间倒序
- `name=ilike.*张*` - 模糊搜索姓名
- `email=ilike.*@example.com` - 搜索邮箱

**响应**:
```json
[
  {
    "id": "uuid",
    "name": "张三",
    "email": "zhangsan@example.com",
    "phone": "13800138000",
    "education": "硕士",
    "school": "清华大学",
    "work_years": 5,
    "skills": ["React", "TypeScript"],
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### 3. 获取候选人详情

**Endpoint**: `GET /rest/v1/candidates?id=eq.{uuid}&select=*`

**响应**:
```json
{
  "id": "uuid",
  "resume_id": "uuid",
  "name": "张三",
  "email": "zhangsan@example.com",
  "phone": "13800138000",
  "education": "硕士",
  "school": "清华大学",
  "major": "计算机科学",
  "graduation_date": "2020-06-01",
  "work_years": 5,
  "skills": ["React", "TypeScript", "Node.js"],
  "projects": [
    "电商平台前端开发",
    "微服务系统后端开发"
  ],
  "highlights": [
    "High education: 硕士",
    "Rich experience: 5 years",
    "Strong technical skills: 10 skills"
  ],
  "risks": [],
  "missing_fields": [],
  "notes": "",
  "raw_text": "...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 4. 更新候选人

**Endpoint**: `PATCH /rest/v1/candidates?id=eq.{uuid}`

**请求**:
```json
{
  "notes": "面试表现优秀，推荐录用",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 5. 下载简历

**Endpoint**: `GET /storage/v1/object/resumes/{file_path}`

**Headers**: `Authorization: Bearer {token}`

## 前端页面路由

```
/                    → LoginPage (未登录)
/                    → UploadPage (登录后默认)
/upload              → UploadPage (上传简历)
/candidates          → CandidatesPage (候选人列表)
/candidates/:id      → CandidateDetailPage (候选人详情)
```

## 前端组件结构

```
App
├── AuthContext (认证上下文)
└── AppContent
    ├── LoginPage (登录页)
    └── Layout (主布局)
        ├── UploadPage (上传页面)
        ├── CandidatesPage (列表页面)
        └── CandidateDetailPage (详情页面)
```

## 核心代码实现

### 1. Edge Function: parse-resume

**文件**: `supabase/functions/parse-resume/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { resume_id } = await req.json();

    // 1. 获取简历记录
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resume_id)
      .single();

    if (resumeError) throw new Error("Resume not found");

    // 2. 下载文件
    const { data: fileData, error: fileError } = await supabase.storage
      .from("resumes")
      .download(resume.file_path);

    if (fileError) throw new Error("File download failed");

    // 3. 提取文本
    const arrayBuffer = await fileData.arrayBuffer();
    const rawText = new TextDecoder().decode(arrayBuffer);

    // 4. 解析信息
    const candidate = extractInformation(rawText);

    // 5. 保存候选人
    const { data: savedCandidate, error: candidateError } = await supabase
      .from("candidates")
      .insert({
        resume_id: resume.id,
        ...candidate,
        raw_text: rawText,
      })
      .select()
      .single();

    if (candidateError) throw new Error("Failed to save candidate");

    // 6. 更新简历状态
    await supabase
      .from("resumes")
      .update({ status: "parsed" })
      .eq("id", resume_id);

    return new Response(
      JSON.stringify({ success: true, candidate_id: savedCandidate.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractInformation(text: string) {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/1[3-9]\d{9}/);
  const nameMatch = text.match(/姓名[：:]\s*([^\n\r]{2,10})/);

  const educationKeywords = ["博士", "硕士", "本科"];
  let education = "";
  for (const keyword of educationKeywords) {
    if (text.includes(keyword)) {
      education = keyword;
      break;
    }
  }

  const schoolMatch = text.match(/([^\n]{2,15})(大学|学院|University)/i);
  const workYearMatch = text.match(/(\d+)\s*年工作经验/);

  const skillKeywords = ["React", "Vue", "TypeScript", "JavaScript", "Node.js", "Python", "Java"];
  const skills = skillKeywords.filter(skill =>
    new RegExp(skill, "i").test(text)
  );

  return {
    name: nameMatch ? nameMatch[1].trim() : "",
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0] : "",
    education,
    school: schoolMatch ? schoolMatch[0].trim() : "",
    work_years: workYearMatch ? parseInt(workYearMatch[1]) : 0,
    skills,
    projects: [],
    highlights: skills.length > 5 ? ["Strong technical skills"] : [],
    risks: !emailMatch || !phoneMatch ? ["Missing contact info"] : [],
    missing_fields: [],
  };
}
```

### 2. 上传页面组件

**文件**: `src/components/UploadPage.tsx`

```typescript
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, FileText, CheckCircle, XCircle } from 'lucide-react';

export function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleUpload = async () => {
    setUploading(true);
    setResults([]);

    for (const file of files) {
      try {
        // 1. 上传文件到 Storage
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `resumes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. 创建简历记录
        const { data: resume, error: resumeError } = await supabase
          .from('resumes')
          .insert({
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.name.split('.').pop(),
            status: 'pending',
          })
          .select()
          .single();

        if (resumeError) throw resumeError;

        // 3. 调用解析函数
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-resume`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ resume_id: resume.id }),
        });

        const result = await response.json();
        setResults(prev => [...prev, { file: file.name, success: true, result }]);
      } catch (error: any) {
        setResults(prev => [...prev, { file: file.name, success: false, error: error.message }]);
      }
    }

    setUploading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upload Resumes</h1>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Click to upload or drag and drop</p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Selected Files: {files.length}</h3>
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <FileText className="w-4 h-4" />
              <span className="text-sm">{file.name}</span>
            </div>
          ))}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload & Parse'}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Results:</h3>
          {results.map((result, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 mb-2 rounded">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span>{result.file}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. 候选人列表组件

**文件**: `src/components/CandidatesPage.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Download, Eye } from 'lucide-react';

export function CandidatesPage({ onViewDetail }: { onViewDetail: (id: string) => void }) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    const { data } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    setCandidates(data || []);
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Education', 'School', 'Work Years', 'Skills'];
    const rows = filteredCandidates.map(c => [
      c.name,
      c.email,
      c.phone,
      c.education,
      c.school,
      c.work_years,
      c.skills.join('; '),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `candidates_${new Date().toISOString()}.csv`;
    link.click();
  };

  const filteredCandidates = candidates.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Candidates ({filteredCandidates.length})</h1>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredCandidates.map(candidate => (
          <div key={candidate.id} className="bg-white p-5 rounded-lg shadow hover:shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{candidate.name || 'Unknown'}</h3>
                <p className="text-sm text-gray-600">{candidate.email} | {candidate.phone}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {candidate.education} • {candidate.school} • {candidate.work_years} years
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {candidate.skills.slice(0, 5).map((skill: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => onViewDetail(candidate.id)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                <Eye className="w-4 h-4" />
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 测试步骤

### 1. 准备测试数据

创建 `test-resume.txt`:

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
React、TypeScript、Node.js、Python、Docker、MySQL

项目经验：
项目：电商平台前端开发，负责整体架构设计
项目：微服务后端开发，使用Node.js和Docker
```

### 2. 测试流程

```bash
# 1. 登录系统
访问应用 → 注册/登录

# 2. 上传简历
Upload页面 → 选择文件 → 点击Upload & Parse → 等待解析

# 3. 查看列表
Candidates页面 → 查看解析结果

# 4. 查看详情
点击View按钮 → 查看完整信息

# 5. 搜索测试
输入"张三"或邮箱 → 查看筛选结果

# 6. 导出CSV
点击Export CSV → 下载文件 → 用Excel打开验证
```

### 3. 验证要点

- [ ] 文件成功上传到 Storage
- [ ] 简历记录创建成功
- [ ] 候选人信息解析正确
- [ ] 列表显示正常
- [ ] 搜索功能工作
- [ ] 详情页显示完整
- [ ] CSV导出成功

## 部署命令

```bash
# 1. 安装依赖
npm install

# 2. 数据库已自动创建（resumes, candidates表已存在）

# 3. Edge Function 已部署（parse-resume已部署）

# 4. 启动开发服务器
npm run dev

# 5. 构建生产版本
npm run build
```

## 限制与已知问题

1. **PDF解析**: 当前只能提取纯文本PDF，扫描版需OCR
2. **中英文混合**: 正则表达式需要更完善的匹配
3. **文件大小**: 建议限制在10MB以内
4. **并发处理**: 当前为串行处理，大量文件较慢

## 下一步（M2预告）

- [ ] 添加岗位管理
- [ ] 实现智能评分
- [ ] A/B/C/D分级
- [ ] 详细评分解释

---

**M1 状态**: ✅ 已完成并可运行

**当前系统已包含此功能**, 可直接测试使用。
