# Milestone 2: 岗位配置与智能评分系统

## 功能范围

✅ 岗位管理（创建/编辑/删除）
✅ 配置 must-have / nice-to-have / reject 规则
✅ 技能权重配置
✅ 智能评分引擎（0-100分）
✅ 自动分级（A/B/C/D）
✅ 详细评分解释（命中/缺失技能）
✅ 按岗位筛选候选人

## 数据库表结构

### 1. positions（岗位表）- 新增

```sql
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,                    -- 岗位标题
  description text DEFAULT '',            -- 岗位描述

  -- 评分规则
  must_skills jsonb DEFAULT '[]'::jsonb,  -- 必备技能 [{skill, weight}]
  nice_skills jsonb DEFAULT '[]'::jsonb,  -- 加分技能 [{skill, weight}]
  reject_keywords jsonb DEFAULT '[]'::jsonb,  -- 拒绝关键词 [string]

  -- 分级阈值
  grade_thresholds jsonb DEFAULT '{"A": 80, "B": 60, "C": 40, "D": 0}'::jsonb,

  status text DEFAULT 'active',           -- active/archived
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_positions_status ON positions(status);
```

**字段说明**:
- `must_skills`: `[{"skill": "React", "weight": 3}, {"skill": "TypeScript", "weight": 2}]`
- `nice_skills`: `[{"skill": "Docker", "weight": 1}]`
- `reject_keywords`: `["在校生", "实习", "培训班"]`
- `grade_thresholds`: `{"A": 80, "B": 60, "C": 40, "D": 0}`

### 2. scores（评分表）- 新增

```sql
CREATE TABLE scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,

  -- 分数
  total_score numeric DEFAULT 0,          -- 总分 0-100
  grade text DEFAULT 'D',                 -- A/B/C/D
  must_score numeric DEFAULT 0,           -- must技能得分
  nice_score numeric DEFAULT 0,           -- nice技能得分
  reject_penalty numeric DEFAULT 0,       -- 拒绝关键词扣分

  -- 详细信息
  scoring_details jsonb DEFAULT '{}'::jsonb,  -- 评分细节
  explanation text DEFAULT '',                -- 评分解释

  -- 匹配情况
  matched_must jsonb DEFAULT '[]'::jsonb,     -- 匹配的must技能
  matched_nice jsonb DEFAULT '[]'::jsonb,     -- 匹配的nice技能
  matched_reject jsonb DEFAULT '[]'::jsonb,   -- 匹配的reject关键词
  missing_must jsonb DEFAULT '[]'::jsonb,     -- 缺失的must技能

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_scores_candidate ON scores(candidate_id);
CREATE INDEX idx_scores_grade ON scores(grade);
CREATE INDEX idx_scores_total ON scores(total_score DESC);
```

### 3. 更新 resumes 表

```sql
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES positions(id);
CREATE INDEX idx_resumes_position ON resumes(position_id);
```

### 4. 更新 candidates 表

```sql
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES positions(id);
CREATE INDEX idx_candidates_position ON candidates(position_id);
```

### RLS 策略

```sql
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage positions"
  ON positions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage scores"
  ON scores FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

## 评分算法详解

### 核心公式

```
Must Score = Σ(matched_must_skill.weight × 10)
Nice Score = Σ(matched_nice_skill.weight × 5)
Reject Penalty = count(matched_reject_keywords) × 15

Total Score = min(100, max(0, Must Score + Nice Score - Reject Penalty))
```

### 分级规则

```
Total Score >= threshold_A  →  Grade A
Total Score >= threshold_B  →  Grade B
Total Score >= threshold_C  →  Grade C
Total Score < threshold_C   →  Grade D
```

### 评分示例

**岗位配置**:
```json
{
  "must_skills": [
    {"skill": "React", "weight": 3},
    {"skill": "TypeScript", "weight": 2},
    {"skill": "Node.js", "weight": 2}
  ],
  "nice_skills": [
    {"skill": "Docker", "weight": 2},
    {"skill": "AWS", "weight": 1}
  ],
  "reject_keywords": ["在校生"],
  "grade_thresholds": {"A": 80, "B": 60, "C": 40, "D": 0}
}
```

**候选人A**（优秀）:
- 有技能: React, TypeScript, Node.js, Docker, AWS
- 无拒绝关键词

计算:
```
Must:   React(3×10) + TypeScript(2×10) + Node.js(2×10) = 70分
Nice:   Docker(2×5) + AWS(1×5) = 15分
Reject: 0
Total:  70 + 15 - 0 = 85分
Grade:  A
```

**候选人B**（中等）:
- 有技能: React, Node.js
- 无拒绝关键词

计算:
```
Must:   React(3×10) + Node.js(2×10) = 50分
Nice:   0
Reject: 0
Total:  50分
Grade:  B
```

**候选人C**（应拒绝）:
- 有技能: React
- 有拒绝关键词: "在校生"

计算:
```
Must:   React(3×10) = 30分
Nice:   0
Reject: 1 × 15 = 15分
Total:  30 - 15 = 15分
Grade:  D
```

## API 接口清单

### 1. 创建岗位

**Endpoint**: `POST /rest/v1/positions`

**请求**:
```json
{
  "title": "Senior Frontend Developer",
  "description": "Looking for experienced React developer",
  "must_skills": [
    {"skill": "React", "weight": 3},
    {"skill": "TypeScript", "weight": 2}
  ],
  "nice_skills": [
    {"skill": "Docker", "weight": 1}
  ],
  "reject_keywords": ["在校生", "实习"],
  "grade_thresholds": {"A": 80, "B": 60, "C": 40, "D": 0}
}
```

**响应**:
```json
{
  "id": "uuid",
  "title": "Senior Frontend Developer",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 2. 获取岗位列表

**Endpoint**: `GET /rest/v1/positions?select=*&order=created_at.desc`

**响应**:
```json
[
  {
    "id": "uuid",
    "title": "Senior Frontend Developer",
    "description": "...",
    "must_skills": [...],
    "nice_skills": [...],
    "reject_keywords": [...],
    "grade_thresholds": {...},
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### 3. 更新岗位

**Endpoint**: `PATCH /rest/v1/positions?id=eq.{uuid}`

**请求**:
```json
{
  "title": "Updated Title",
  "must_skills": [...],
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 4. 删除岗位

**Endpoint**: `DELETE /rest/v1/positions?id=eq.{uuid}`

### 5. 获取候选人评分

**Endpoint**: `GET /rest/v1/scores?candidate_id=eq.{uuid}&select=*`

**响应**:
```json
{
  "id": "uuid",
  "candidate_id": "uuid",
  "total_score": 85.0,
  "grade": "A",
  "must_score": 70.0,
  "nice_score": 15.0,
  "reject_penalty": 0,
  "matched_must": ["React", "TypeScript", "Node.js"],
  "matched_nice": ["Docker", "AWS"],
  "matched_reject": [],
  "missing_must": [],
  "explanation": "Score Breakdown:\n- Must-have: 70pts...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 6. 获取岗位候选人列表

**Endpoint**: `GET /rest/v1/candidates?position_id=eq.{uuid}&select=*`

带评分:
```
GET /rest/v1/candidates?position_id=eq.{uuid}&select=*,scores(*)
```

## 前端页面路由（新增）

```
/positions           → PositionsPage (岗位列表)
/positions/new       → PositionForm (新建岗位)
/positions/:id/edit  → PositionForm (编辑岗位)
```

## 前端组件结构（新增）

```
Layout
└── PositionsPage
    ├── PositionList (岗位列表)
    │   ├── PositionCard (岗位卡片)
    │   └── DeleteButton (删除按钮)
    └── PositionForm (岗位表单)
        ├── SkillsInput (技能输入)
        ├── KeywordsInput (关键词输入)
        └── ThresholdsInput (阈值输入)
```

## 核心代码实现

### 1. 评分算法（集成到 parse-resume）

**文件**: `supabase/functions/parse-resume/index.ts`（添加评分逻辑）

```typescript
// ... 原有代码 ...

// 在保存候选人后，立即计算评分
if (resume.position_id) {
  // 获取岗位信息
  const { data: position } = await supabase
    .from("positions")
    .select("*")
    .eq("id", resume.position_id)
    .single();

  if (position) {
    // 计算评分
    const score = calculateScore(candidate, position);

    // 保存评分
    await supabase.from("scores").insert({
      candidate_id: savedCandidate.id,
      ...score,
    });
  }
}

// 评分函数
function calculateScore(candidate: any, position: any) {
  let mustScore = 0;
  let niceScore = 0;
  let rejectPenalty = 0;

  const matchedMust: string[] = [];
  const missingMust: string[] = [];
  const matchedNice: string[] = [];
  const matchedReject: string[] = [];

  const candidateSkills = candidate.skills.map((s: string) => s.toLowerCase());
  const rawText = candidate.raw_text.toLowerCase();

  // 计算 Must 分数
  for (const mustSkill of position.must_skills) {
    const skillLower = mustSkill.skill.toLowerCase();
    if (candidateSkills.includes(skillLower) || rawText.includes(skillLower)) {
      mustScore += mustSkill.weight * 10;
      matchedMust.push(mustSkill.skill);
    } else {
      missingMust.push(mustSkill.skill);
    }
  }

  // 计算 Nice 分数
  for (const niceSkill of position.nice_skills) {
    const skillLower = niceSkill.skill.toLowerCase();
    if (candidateSkills.includes(skillLower) || rawText.includes(skillLower)) {
      niceScore += niceSkill.weight * 5;
      matchedNice.push(niceSkill.skill);
    }
  }

  // 计算 Reject 扣分
  for (const keyword of position.reject_keywords) {
    if (rawText.includes(keyword.toLowerCase())) {
      rejectPenalty += 15;
      matchedReject.push(keyword);
    }
  }

  // 总分
  const totalScore = Math.max(0, Math.min(100, mustScore + niceScore - rejectPenalty));

  // 分级
  let grade = "D";
  const thresholds = position.grade_thresholds;
  if (totalScore >= thresholds.A) grade = "A";
  else if (totalScore >= thresholds.B) grade = "B";
  else if (totalScore >= thresholds.C) grade = "C";

  // 生成解释
  const explanation = `
Score Breakdown:
- Must-have skills: ${mustScore} points (matched ${matchedMust.length}/${position.must_skills.length})
- Nice-to-have skills: ${niceScore} points (matched ${matchedNice.length}/${position.nice_skills.length})
- Reject penalty: -${rejectPenalty} points (found ${matchedReject.length} keywords)

Total Score: ${totalScore.toFixed(1)} / 100
Grade: ${grade}

${missingMust.length > 0 ? `Missing: ${missingMust.join(", ")}` : ""}
${matchedReject.length > 0 ? `Warning: ${matchedReject.join(", ")}` : ""}
`.trim();

  return {
    total_score: totalScore,
    grade,
    must_score: mustScore,
    nice_score: niceScore,
    reject_penalty: rejectPenalty,
    matched_must: matchedMust,
    matched_nice: matchedNice,
    matched_reject: matchedReject,
    missing_must: missingMust,
    explanation,
    scoring_details: {
      matched_must_count: matchedMust.length,
      total_must_count: position.must_skills.length,
    },
  };
}
```

### 2. 岗位管理页面

**文件**: `src/components/PositionsPage.tsx`（已实现）

核心功能:
- 创建/编辑/删除岗位
- Must/Nice技能配置（格式: `技能名: 权重`）
- Reject关键词配置（每行一个）
- A/B/C/D阈值配置

### 3. 候选人列表增强

**文件**: `src/components/CandidatesPage.tsx`（已实现）

新增功能:
- 显示评分和等级
- 按岗位筛选
- 按等级筛选
- 按分数排序

### 4. 候选人详情增强

**文件**: `src/components/CandidateDetailPage.tsx`（已实现）

新增显示:
- 总分和等级（突出显示）
- Must/Nice/Reject分项得分
- 匹配的技能（绿色标签）
- 缺失的技能（红色标签）
- 详细评分解释

## 测试步骤

### 1. 创建岗位

```bash
# 导航到 Positions 页面
1. 点击 "New Position"
2. 填写表单:
   Title: Senior Frontend Developer

   Must-Have Skills:
   React: 3
   TypeScript: 2
   Node.js: 2

   Nice-to-Have Skills:
   Docker: 1
   AWS: 1

   Reject Keywords:
   在校生
   实习

   Thresholds:
   A: 80, B: 60, C: 40

3. 点击 "Create"
```

### 2. 上传简历

```bash
# 导航到 Upload 页面
1. 选择岗位: Senior Frontend Developer
2. 上传测试简历
3. 等待解析完成
```

### 3. 查看评分

```bash
# 导航到 Candidates 页面
1. 查看候选人卡片上的分数和等级
2. 按等级筛选: Grade A
3. 按分数排序: Score (High to Low)
```

### 4. 查看详情

```bash
# 点击候选人的 View 按钮
1. 查看总分和等级（大字号显示）
2. 查看分项得分（Must/Nice/Reject）
3. 查看匹配的技能（绿色）
4. 查看缺失的技能（红色）
5. 阅读详细解释
```

### 5. 测试评分准确性

**准备3个测试简历**:

**test-high-score.txt** (预期 Grade A):
```
姓名：高分候选人
邮箱：high@example.com
电话：13800138001
学历：硕士
学校：清华大学
工作经验：5年

技能：React、TypeScript、Node.js、Docker、AWS、Python、MySQL
```

**test-mid-score.txt** (预期 Grade B):
```
姓名：中等候选人
邮箱：mid@example.com
电话：13800138002
学历：本科
学校：北京大学
工作经验：3年

技能：React、Node.js、JavaScript、MySQL
```

**test-low-score.txt** (预期 Grade D, 有拒绝关键词):
```
姓名：低分候选人
邮箱：low@example.com
电话：13800138003
学历：本科
学校：某大学
在校生，寻找实习机会

技能：HTML、CSS、JavaScript基础
```

### 6. 验证结果

| 简历 | 预期分数 | 预期等级 | Must匹配 | Nice匹配 | Reject命中 |
|------|---------|---------|---------|---------|-----------|
| High | 85+ | A | 3/3 | 2/2 | 0 |
| Mid | 50-60 | B | 2/3 | 0/2 | 0 |
| Low | <40 | D | 0/3 | 0/2 | 2 |

## 部署命令

```bash
# 1. 数据库表已自动创建（positions, scores 已存在）

# 2. Edge Function 已更新（包含评分逻辑）

# 3. 前端组件已实现（PositionsPage 已存在）

# 4. 重新构建
npm run build

# 5. 测试
npm run dev
```

## M1 → M2 迁移指南

### 数据迁移

如果您有M1的现有数据需要迁移:

```sql
-- 1. 创建默认岗位
INSERT INTO positions (title, description, must_skills, nice_skills)
VALUES (
  'General Position',
  'Default position for existing candidates',
  '[{"skill": "Programming", "weight": 1}]'::jsonb,
  '[]'::jsonb
)
RETURNING id;

-- 2. 将现有candidates关联到默认岗位
UPDATE candidates
SET position_id = '你的默认岗位ID'
WHERE position_id IS NULL;

-- 3. 为现有candidates生成评分
-- 需要重新运行 parse-resume 或手动插入默认分数
```

## 优化建议

### 1. 评分权重调优

根据实际情况调整:
- Must技能权重: 5-15分（当前10分）
- Nice技能权重: 1-10分（当前5分）
- Reject扣分: 10-30分（当前15分）

### 2. 分级阈值调整

根据候选人质量调整:
- 严格模式: A≥90, B≥75, C≥60
- 标准模式: A≥80, B≥60, C≥40 (当前)
- 宽松模式: A≥70, B≥50, C≥30

### 3. 技能匹配优化

- 支持同义词匹配 (React = ReactJS)
- 支持模糊匹配 (Node = Node.js = NodeJS)
- 支持中英文映射 (前端 = Frontend)

## 限制与已知问题

1. **技能匹配**: 简单字符串匹配，可能有误判
2. **权重固定**: 不支持动态权重调整
3. **评分公式**: 线性加权，可能需要更复杂算法
4. **历史评分**: 修改岗位后已有评分不会自动更新

## 下一步（M3预告）

- [ ] 邮箱IMAP集成
- [ ] 异步任务队列
- [ ] 批量处理进度
- [ ] 失败重试机制
- [ ] 任务状态追踪

---

**M2 状态**: ✅ 已完成并可运行

**当前系统已包含此功能**, 可直接测试使用。
