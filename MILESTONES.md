# AI 简历初筛系统 - 三阶段里程碑

## 概览

本项目分3个里程碑逐步实现，每个里程碑都是**独立可运行**的完整系统。

### M1: 基础简历上传和解析系统 ✅
**目标**: 手动上传PDF → 文本解析 → 候选人列表/详情 → CSV导出

**核心功能**:
- 手动批量上传简历文件
- 自动解析提取候选人信息
- 候选人列表展示（搜索、筛选）
- 候选人详情页
- CSV批量导出

**数据库表**: `resumes`, `candidates`

---

### M2: 岗位配置与智能评分系统
**目标**: 加入岗位JD配置 → 规则评分(A/B/C/D) → 解释理由

**新增功能**:
- 岗位管理（创建/编辑岗位）
- 配置 must/nice/reject 规则与权重
- 智能评分引擎（0-100分 + A/B/C/D）
- 详细评分解释（命中/缺失技能）
- 按岗位筛选候选人

**数据库表**: `positions`, `scores`（新增）

---

### M3: 邮箱导入与异步处理系统
**目标**: 邮箱IMAP拉取 → 异步队列 → 进度显示 → 失败重试

**新增功能**:
- IMAP邮箱配置管理
- 自动拉取邮件附件
- 异步任务队列
- 实时进度显示
- 失败重试机制
- 批量处理状态追踪

**数据库表**: `email_configs`, `import_jobs`, `job_items`（新增）

---

## 当前状态

✅ **所有里程碑已完成**

系统已经包含所有3个里程碑的功能。如果您需要查看每个里程碑的独立实现，请参考以下文档：

- `MILESTONE_M1.md` - M1详细文档
- `MILESTONE_M2.md` - M2详细文档
- `MILESTONE_M3.md` - M3详细文档

## 快速测试每个里程碑

### 测试 M1 功能
```bash
1. 登录系统
2. 上传简历文件（Upload Resumes页面）
3. 查看解析结果（Candidates页面）
4. 查看详情（点击View按钮）
5. 导出CSV（点击Export CSV）
```

### 测试 M2 功能
```bash
1. 创建岗位（Positions页面）
2. 配置评分规则（must/nice/reject）
3. 上传简历并关联岗位
4. 查看自动评分结果（A/B/C/D）
5. 查看评分解释（详情页）
```

### 测试 M3 功能
```bash
1. 配置邮箱（Email Import页面）
2. 点击导入（Import Latest Resumes）
3. 查看导入进度（实时显示）
4. 查看导入结果（Candidates页面）
5. 查看失败记录（如有）
```

## 技术栈演进

### M1 技术栈
- React + TypeScript
- Supabase (Database + Storage)
- Edge Function: parse-resume
- 同步处理

### M2 技术栈
- + 评分算法引擎
- + 规则引擎
- + 详细解释生成

### M3 技术栈
- + IMAP 集成（当前为mock）
- + 异步任务队列
- + 实时进度追踪
- + 错误处理与重试

## 数据库演进

### M1 Schema
```sql
resumes (简历文件)
├── id
├── file_name
├── file_path
├── status
└── created_at

candidates (候选人)
├── id
├── resume_id
├── name, email, phone
├── education, school, major
├── skills, projects
└── created_at
```

### M2 Schema (新增)
```sql
positions (岗位)
├── id
├── title, description
├── must_skills, nice_skills
├── reject_keywords
└── grade_thresholds

scores (评分)
├── id
├── candidate_id, position_id
├── total_score, grade
├── matched/missing skills
└── explanation
```

### M3 Schema (新增)
```sql
email_configs (邮箱配置)
├── id
├── position_id
├── server, port, email
└── last_sync_at

import_jobs (导入任务)
├── id
├── config_id
├── status, progress
└── error_message

job_items (任务项)
├── id
├── job_id
├── file_name, status
└── error_detail
```

## API 接口演进

### M1 APIs
- `POST /functions/v1/parse-resume` - 解析单个简历

### M2 APIs
- `POST /functions/v1/calculate-score` - 计算评分（已集成到parse-resume）

### M3 APIs
- `POST /functions/v1/import-emails` - 导入邮件附件
- `GET /functions/v1/import-status` - 查询导入进度

## 前端页面演进

### M1 Pages
- Login - 登录
- Upload - 上传简历
- Candidates - 候选人列表
- CandidateDetail - 候选人详情

### M2 Pages (新增)
- Positions - 岗位管理
- PositionForm - 岗位表单

### M3 Pages (新增)
- EmailConfig - 邮箱配置
- ImportProgress - 导入进度

## 部署说明

每个里程碑都可以独立部署：

### M1 部署
```bash
# 1. 创建 M1 数据库表
npm run migrate:m1

# 2. 部署 parse-resume 函数
npm run deploy:parse-resume

# 3. 构建前端
npm run build

# 4. 启动
npm run dev
```

### M2 部署
```bash
# 在 M1 基础上
npm run migrate:m2        # 新增 positions, scores 表
npm run deploy:scoring    # 部署评分函数（已集成）
npm run build
```

### M3 部署
```bash
# 在 M2 基础上
npm run migrate:m3           # 新增 email_configs, jobs 表
npm run deploy:import-emails # 部署邮件导入函数
npm run build
```

## 测试数据

每个里程碑都有对应的测试数据：

- `test-data-m1.txt` - M1基础简历
- `test-data-m2.txt` - M2带技能简历
- `test-data-m3.txt` - M3邮件场景

详见 `SAMPLE_DATA.md`

## 注意事项

1. **M1 → M2**: 需要为所有候选人补充 position_id
2. **M2 → M3**: 需要配置邮箱凭证
3. **生产环境**: M3 的 IMAP 需要替换 mock 实现

## 下一步

当前系统已完整实现所有功能。如需：

1. **回退到某个里程碑**: 查看对应的 MILESTONE_MX.md
2. **自定义功能**: 参考 PROJECT_STRUCTURE.md
3. **生产部署**: 参考 README.md 的生产部署章节

---

每个里程碑的详细实现文档请查看对应的 MILESTONE_MX.md 文件。
