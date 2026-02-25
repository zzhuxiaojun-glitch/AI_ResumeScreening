# 岗位筛选规则引擎使用指南

## 概述

这是一个功能完整的岗位筛选规则引擎，支持多维度评分、规则版本管理和详细的评分解释。

## 核心特性

✅ **多维度规则支持**
- Must-have 技能（必备技能）
- Nice-to-have 技能（加分技能）
- 数值规则（年限、数量等）
- 枚举规则（学历等）
- 拒绝关键词

✅ **灵活的匹配方式**
- 关键词匹配（默认）
- 正则表达式匹配
- 数值范围匹配（>=, <=, >, <, =, range）
- 枚举值匹配

✅ **完整的评分体系**
- 0-100 分数计算
- A/B/C/D 自动分级
- 分项得分（Must/Nice/Numeric/Enum）
- 扣分机制（Reject keywords）

✅ **详细的分析报告**
- 命中的技能列表
- 缺失的技能列表
- 风险点识别
- 可读的解释文本
- 简短总结

✅ **版本管理**
- 规则版本号
- 评分时间戳
- 历史版本回溯
- 结果对比

## 快速开始

### 1. 基础使用

```typescript
import { ScoringEngine, ScoringRules, CandidateData } from './lib/scoring-engine';

// 定义规则
const rules: ScoringRules = {
  version: '1.0.0',
  must_skills: [
    { skill: 'React', weight: 3 },
    { skill: 'TypeScript', weight: 2 },
  ],
  nice_skills: [
    { skill: 'Docker', weight: 1 },
  ],
  numeric_rules: [
    {
      field: 'work_years',
      operator: '>=',
      value: 3,
      weight: 2,
      label: '3年以上经验',
    },
  ],
  enum_rules: [
    {
      field: 'education',
      values: ['本科', '硕士', '博士'],
      weight: 1,
      label: '本科及以上',
    },
  ],
  reject_rules: [
    { keyword: '在校生', penalty: 20 },
  ],
  grade_thresholds: { A: 80, B: 60, C: 40, D: 0 },
  must_weight_multiplier: 10,
  nice_weight_multiplier: 5,
};

// 创建引擎
const engine = new ScoringEngine(rules);

// 候选人数据
const candidate: CandidateData = {
  name: '张三',
  email: 'zhangsan@example.com',
  phone: '13800138000',
  education: '硕士',
  school: '清华大学',
  major: '计算机',
  work_years: 5,
  skills: ['React', 'TypeScript', 'Docker'],
  projects: ['电商平台开发'],
  raw_text: '详细简历文本...',
};

// 评分
const result = engine.score(candidate);

// 使用结果
console.log(`总分: ${result.total_score}`);
console.log(`等级: ${result.grade}`);
console.log(`总结: ${result.summary}`);
console.log(result.explanation);
```

### 2. 使用默认规则模板

```typescript
import { createDefaultRules, ScoringEngine } from './lib/scoring-engine';

// 创建默认规则
const rules = createDefaultRules('Frontend Developer');

// 自定义调整
rules.must_skills.push({ skill: 'Vue', weight: 2 });
rules.grade_thresholds.A = 85; // 提高 A 级标准

const engine = new ScoringEngine(rules);
```

## 规则配置详解

### Must-have Skills（必备技能）

```typescript
must_skills: [
  {
    skill: 'React',           // 技能名称
    weight: 3,                // 权重 1-5（越高越重要）
    type: 'keyword',          // 匹配类型：keyword | regex
    pattern: undefined,       // 正则表达式（可选）
  },
]
```

**评分规则**:
- 匹配得分 = `weight × must_weight_multiplier`（默认 ×10）
- 权重建议：
  - 5: 核心关键技能
  - 3-4: 重要技能
  - 1-2: 基础技能

### Nice-to-have Skills（加分技能）

```typescript
nice_skills: [
  {
    skill: 'Docker',
    weight: 2,
  },
]
```

**评分规则**:
- 匹配得分 = `weight × nice_weight_multiplier`（默认 ×5）
- 不匹配不扣分，只是加分项

### Numeric Rules（数值规则）

```typescript
numeric_rules: [
  {
    field: 'work_years',     // 字段名
    operator: '>=',          // 操作符：>=, <=, >, <, =, range
    value: 3,                // 值或范围 [min, max]
    weight: 2,               // 权重
    label: '3年以上经验',    // 显示标签
  },
]
```

**支持的操作符**:
- `>=`: 大于等于
- `<=`: 小于等于
- `>`: 大于
- `<`: 小于
- `=`: 等于
- `range`: 范围内 `[min, max]`

**示例**:
```typescript
// 年限范围
{
  field: 'work_years',
  operator: 'range',
  value: [3, 7],
  weight: 2,
  label: '3-7年经验',
}

// 项目数量
{
  field: 'project_count',
  operator: '>=',
  value: 5,
  weight: 1,
  label: '至少5个项目',
}
```

### Enum Rules（枚举规则）

```typescript
enum_rules: [
  {
    field: 'education',                    // 字段名
    values: ['本科', '硕士', '博士'],      // 允许的值
    weight: 1,                             // 权重
    label: '本科及以上学历',               // 显示标签
  },
]
```

**示例**:
```typescript
// 学历要求
{
  field: 'education',
  values: ['硕士', '博士'],
  weight: 2,
  label: '硕士及以上',
}

// 城市要求
{
  field: 'city',
  values: ['北京', '上海', '深圳', '杭州'],
  weight: 1,
  label: '一线城市',
}
```

### Reject Rules（拒绝规则）

```typescript
reject_rules: [
  {
    keyword: '在校生',           // 关键词
    penalty: 20,                // 扣分
    description: '在校学生',     // 描述（可选）
  },
]
```

**注意**:
- 匹配到关键词会直接扣分
- 可能导致总分为负（但会被限制在 0-100）
- 建议扣分：15-30 分

### Grade Thresholds（分级阈值）

```typescript
grade_thresholds: {
  A: 80,  // A级：80分及以上
  B: 60,  // B级：60-79分
  C: 40,  // C级：40-59分
  D: 0,   // D级：0-39分
}
```

**分级建议**:
- **严格模式**: A≥90, B≥75, C≥60
- **标准模式**: A≥80, B≥60, C≥40（推荐）
- **宽松模式**: A≥70, B≥50, C≥30

## 高级功能

### 1. 正则表达式匹配

```typescript
must_skills: [
  {
    skill: 'React',
    weight: 3,
    type: 'regex',
    pattern: 'react|reactjs|react\\.js',  // 匹配多种写法
  },
  {
    skill: 'Node',
    weight: 2,
    type: 'regex',
    pattern: 'node(\\.js)?|nodejs',       // Node 或 Node.js
  },
]
```

### 2. 版本管理

```typescript
// 规则 v1.0.0
const rulesV1: ScoringRules = {
  version: '1.0.0',
  must_skills: [/* ... */],
  // ...
};

// 规则 v2.0.0（调整权重）
const rulesV2: ScoringRules = {
  version: '2.0.0',
  must_skills: [
    { skill: 'React', weight: 4 },  // 提高权重
    // ...
  ],
  // ...
};

// 使用不同版本评分
const engineV1 = new ScoringEngine(rulesV1);
const engineV2 = new ScoringEngine(rulesV2);

const resultV1 = engineV1.score(candidate);
const resultV2 = engineV2.score(candidate);

// 比较结果
import { compareResults } from './lib/scoring-engine';
const comparison = compareResults(resultV1, resultV2);

console.log(`分数变化: ${comparison.score_diff}`);
console.log(`等级改变: ${comparison.grade_changed}`);
```

### 3. 批量评分

```typescript
const candidates: CandidateData[] = [/* ... */];

const results = candidates.map(candidate => ({
  candidate,
  result: engine.score(candidate),
}));

// 按分数排序
results.sort((a, b) => b.result.total_score - a.result.total_score);

// 筛选 A 级候选人
const gradeA = results.filter(r => r.result.grade === 'A');
```

### 4. 导出规则配置

```typescript
// 导出当前规则
const exportedRules = engine.exportRules();

// 保存到数据库
await supabase.from('scoring_rules').insert({
  position_id: 'xxx',
  version: exportedRules.version,
  rules: exportedRules,
  created_at: new Date().toISOString(),
});

// 从数据库加载
const { data } = await supabase
  .from('scoring_rules')
  .select('rules')
  .eq('position_id', 'xxx')
  .single();

const engine = new ScoringEngine(data.rules);
```

## 评分结果详解

### ScoringResult 结构

```typescript
interface ScoringResult {
  // 基本分数
  total_score: number;        // 总分 0-100
  grade: 'A' | 'B' | 'C' | 'D';

  // 分项得分
  must_score: number;         // Must 技能得分
  nice_score: number;         // Nice 技能得分
  numeric_score: number;      // 数值规则得分
  enum_score: number;         // 枚举规则得分
  reject_penalty: number;     // 拒绝扣分

  // 匹配详情
  matched_must: MatchedItem[];
  matched_nice: MatchedItem[];
  matched_numeric: MatchedItem[];
  matched_enum: MatchedItem[];
  matched_reject: string[];

  // 缺失详情
  missing_must: MissingItem[];
  missing_nice: MissingItem[];

  // 风险分析
  risks: RiskItem[];

  // 文本说明
  explanation: string;        // 详细解释
  summary: string;            // 简短总结

  // 元数据
  rule_version: string;       // 规则版本
  scored_at: string;          // 评分时间
}
```

### 使用示例

```typescript
const result = engine.score(candidate);

// 1. 基本信息
console.log(`姓名: ${candidate.name}`);
console.log(`总分: ${result.total_score}`);
console.log(`等级: ${result.grade}`);
console.log(`总结: ${result.summary}`);

// 2. 分项得分
console.log('\n分项得分:');
console.log(`  Must: ${result.must_score}`);
console.log(`  Nice: ${result.nice_score}`);
console.log(`  数值: ${result.numeric_score}`);
console.log(`  枚举: ${result.enum_score}`);
console.log(`  扣分: -${result.reject_penalty}`);

// 3. 匹配技能
console.log('\n匹配的 Must 技能:');
result.matched_must.forEach(m => {
  console.log(`  ✓ ${m.name} (权重${m.weight}, +${m.score}分)`);
});

// 4. 缺失技能
console.log('\n缺失的 Must 技能:');
result.missing_must.forEach(m => {
  console.log(`  ✗ ${m.name} (权重${m.weight}, 损失${m.potential_score}分)`);
});

// 5. 风险点
if (result.risks.length > 0) {
  console.log('\n风险提示:');
  result.risks.forEach(risk => {
    console.log(`  ${risk.severity}: ${risk.description}`);
    console.log(`     → ${risk.impact}`);
  });
}

// 6. 详细解释
console.log('\n' + result.explanation);
```

## 实际应用场景

### 场景1: 前端开发岗位

```typescript
const frontendRules: ScoringRules = {
  version: '1.0.0',
  must_skills: [
    { skill: 'JavaScript', weight: 3 },
    { skill: 'React', weight: 4, type: 'regex', pattern: 'react|reactjs' },
    { skill: 'HTML', weight: 2 },
    { skill: 'CSS', weight: 2 },
  ],
  nice_skills: [
    { skill: 'TypeScript', weight: 3 },
    { skill: 'Next.js', weight: 2 },
    { skill: 'Tailwind CSS', weight: 1 },
    { skill: 'Webpack', weight: 1 },
  ],
  numeric_rules: [
    {
      field: 'work_years',
      operator: '>=',
      value: 3,
      weight: 3,
      label: '3年以上前端经验',
    },
  ],
  enum_rules: [
    {
      field: 'education',
      values: ['本科', '硕士', '博士'],
      weight: 1,
      label: '本科及以上学历',
    },
  ],
  reject_rules: [
    { keyword: '在校生', penalty: 25 },
    { keyword: '培训班', penalty: 20 },
    { keyword: '应届', penalty: 15 },
  ],
  grade_thresholds: { A: 85, B: 65, C: 45, D: 0 },
  must_weight_multiplier: 10,
  nice_weight_multiplier: 5,
};
```

### 场景2: 全栈开发岗位

```typescript
const fullstackRules: ScoringRules = {
  version: '1.0.0',
  must_skills: [
    { skill: 'React', weight: 3 },
    { skill: 'Node.js', weight: 3 },
    { skill: 'TypeScript', weight: 2 },
    { skill: 'SQL', weight: 2, type: 'regex', pattern: 'sql|mysql|postgresql' },
  ],
  nice_skills: [
    { skill: 'Docker', weight: 2 },
    { skill: 'Kubernetes', weight: 2 },
    { skill: 'AWS', weight: 2 },
    { skill: 'Redis', weight: 1 },
  ],
  numeric_rules: [
    {
      field: 'work_years',
      operator: 'range',
      value: [3, 8],
      weight: 3,
      label: '3-8年开发经验',
    },
  ],
  enum_rules: [
    {
      field: 'education',
      values: ['本科', '硕士', '博士'],
      weight: 1,
      label: '本科及以上',
    },
  ],
  reject_rules: [
    { keyword: '在校生', penalty: 30 },
    { keyword: '转行', penalty: 15 },
  ],
  grade_thresholds: { A: 80, B: 60, C: 40, D: 0 },
  must_weight_multiplier: 10,
  nice_weight_multiplier: 5,
};
```

### 场景3: 高级架构师岗位

```typescript
const architectRules: ScoringRules = {
  version: '1.0.0',
  must_skills: [
    { skill: '微服务', weight: 5, type: 'regex', pattern: '微服务|microservice' },
    { skill: '系统设计', weight: 5 },
    { skill: '性能优化', weight: 4 },
    { skill: 'Java', weight: 3 },
  ],
  nice_skills: [
    { skill: 'Kubernetes', weight: 3 },
    { skill: '领域驱动设计', weight: 2 },
    { skill: '团队管理', weight: 2 },
  ],
  numeric_rules: [
    {
      field: 'work_years',
      operator: '>=',
      value: 8,
      weight: 5,
      label: '8年以上经验',
    },
  ],
  enum_rules: [
    {
      field: 'education',
      values: ['硕士', '博士'],
      weight: 2,
      label: '硕士及以上学历',
    },
  ],
  reject_rules: [
    { keyword: '初级', penalty: 30 },
    { keyword: '转行', penalty: 25 },
  ],
  grade_thresholds: { A: 90, B: 75, C: 60, D: 0 },
  must_weight_multiplier: 12,  // 提高 Must 权重
  nice_weight_multiplier: 6,
};
```

## 最佳实践

### 1. 权重设置建议

```
Must技能权重分配:
- 5: 绝对核心（如架构师的"系统设计"）
- 3-4: 重要技能（如前端的"React"）
- 1-2: 基础技能（如"HTML"）

Nice技能权重分配:
- 2-3: 重要加分项
- 1: 一般加分项
```

### 2. 阈值设置建议

```
根据岗位级别调整:
- 初级岗位: A≥70, B≥50, C≥30
- 中级岗位: A≥80, B≥60, C≥40
- 高级岗位: A≥85, B≥70, C≥50
- 专家岗位: A≥90, B≥75, C≥60
```

### 3. 规则版本管理

```typescript
// 使用语义化版本号
版本格式: MAJOR.MINOR.PATCH
- MAJOR: 评分逻辑大改（如改变分级标准）
- MINOR: 添加新规则或调整权重
- PATCH: 修复规则或小调整

示例:
1.0.0 → 1.0.1: 修复正则表达式错误
1.0.1 → 1.1.0: 添加新的 Nice 技能
1.1.0 → 2.0.0: 大幅调整 Must 技能权重
```

### 4. 性能优化

```typescript
// 批量评分时使用单个引擎实例
const engine = new ScoringEngine(rules);

const results = candidates.map(candidate => {
  return {
    id: candidate.id,
    result: engine.score(candidate),
  };
});

// 而不是为每个候选人创建新引擎
// ❌ 不推荐
candidates.forEach(candidate => {
  const engine = new ScoringEngine(rules); // 重复创建
  const result = engine.score(candidate);
});
```

## 测试

运行测试套件:

```bash
# 安装测试依赖（如使用 Jest）
npm install --save-dev jest @types/jest ts-jest

# 运行测试
npm test src/lib/scoring-engine.test.ts

# 查看覆盖率
npm test -- --coverage
```

测试覆盖:
- ✅ 规则验证
- ✅ 评分计算
- ✅ 匹配逻辑
- ✅ 分级判定
- ✅ 风险识别
- ✅ 边界条件
- ✅ 性能测试

## 常见问题

### Q: 如何调试评分不准确？

```typescript
const result = engine.score(candidate);

// 查看详细解释
console.log(result.explanation);

// 检查匹配情况
console.log('匹配的 Must:', result.matched_must);
console.log('缺失的 Must:', result.missing_must);

// 检查候选人原始文本
console.log('原始文本:', candidate.raw_text);
```

### Q: 为什么有些技能没有匹配到？

可能原因:
1. 大小写问题（已处理，不区分大小写）
2. 技能名称不完全匹配（使用正则表达式）
3. 技能在 raw_text 中但不在 skills 列表

解决:
```typescript
// 使用正则匹配多种写法
{
  skill: 'React',
  type: 'regex',
  pattern: 'react|reactjs|react\\.js',
}
```

### Q: 如何处理同义词？

```typescript
// 方法1: 正则表达式
{
  skill: 'Frontend',
  type: 'regex',
  pattern: 'frontend|front-end|前端',
}

// 方法2: 多个规则
must_skills: [
  { skill: 'React', weight: 3 },
  { skill: 'ReactJS', weight: 3 },
  { skill: 'React.js', weight: 3 },
]
// 注意: 这会导致重复计分，需要业务逻辑去重
```

### Q: 总分超过100怎么办？

引擎自动限制在0-100范围:
```typescript
const totalScore = Math.max(0, Math.min(100, calculatedScore));
```

## 更新日志

### v1.0.0 (2024-01-01)
- ✅ 初始版本
- ✅ Must/Nice/Numeric/Enum/Reject 规则支持
- ✅ 关键词和正则匹配
- ✅ 版本管理
- ✅ 详细评分解释
- ✅ 风险识别
- ✅ 完整测试套件

---

**作者**: AI Assistant
**许可**: MIT
**最后更新**: 2024-01-01
