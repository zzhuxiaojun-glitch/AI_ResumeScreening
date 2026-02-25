"""
岗位筛选规则引擎 - Python 实现

功能：
- 支持 must/nice/reject 规则配置
- 支持关键词、正则、数值范围、枚举匹配
- 生成 0-100 分数和 A/B/C/D 等级
- 详细评分解释和风险点分析
- 规则版本管理
"""

import re
import json
from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum


# ==================== 枚举类型 ====================

class MatchType(str, Enum):
    KEYWORD = 'keyword'
    REGEX = 'regex'


class NumericOperator(str, Enum):
    GTE = '>='
    LTE = '<='
    GT = '>'
    LT = '<'
    EQ = '='
    RANGE = 'range'


class Grade(str, Enum):
    A = 'A'
    B = 'B'
    C = 'C'
    D = 'D'


class RiskType(str, Enum):
    REJECT_KEYWORD = 'reject_keyword'
    MISSING_MUST = 'missing_must'
    LOW_EXPERIENCE = 'low_experience'
    LOW_EDUCATION = 'low_education'
    OTHER = 'other'


class RiskSeverity(str, Enum):
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'


# ==================== 数据类 ====================

@dataclass
class SkillRule:
    skill: str
    weight: int
    type: MatchType = MatchType.KEYWORD
    pattern: Optional[str] = None


@dataclass
class NumericRule:
    field: str
    operator: NumericOperator
    value: Union[int, float, Tuple[Union[int, float], Union[int, float]]]
    weight: int
    label: str


@dataclass
class EnumRule:
    field: str
    values: List[str]
    weight: int
    label: str


@dataclass
class RejectRule:
    keyword: str
    penalty: int
    description: Optional[str] = None


@dataclass
class GradeThresholds:
    A: int = 80
    B: int = 60
    C: int = 40
    D: int = 0


@dataclass
class ScoringRules:
    version: str
    must_skills: List[SkillRule] = field(default_factory=list)
    nice_skills: List[SkillRule] = field(default_factory=list)
    numeric_rules: List[NumericRule] = field(default_factory=list)
    enum_rules: List[EnumRule] = field(default_factory=list)
    reject_rules: List[RejectRule] = field(default_factory=list)
    grade_thresholds: GradeThresholds = field(default_factory=GradeThresholds)
    must_weight_multiplier: int = 10
    nice_weight_multiplier: int = 5
    created_at: Optional[str] = None
    description: Optional[str] = None


@dataclass
class CandidateData:
    name: str
    email: str
    phone: str
    education: str
    school: str
    major: str
    work_years: Union[int, float]
    skills: List[str]
    projects: List[str]
    raw_text: str
    graduation_date: Optional[str] = None
    extra_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MatchedItem:
    name: str
    weight: int
    score: float
    matched_via: Optional[str] = None


@dataclass
class MissingItem:
    name: str
    weight: int
    potential_score: float


@dataclass
class RiskItem:
    type: RiskType
    severity: RiskSeverity
    description: str
    impact: str


@dataclass
class ScoringResult:
    total_score: float
    grade: Grade

    must_score: float
    nice_score: float
    numeric_score: float
    enum_score: float
    reject_penalty: float

    matched_must: List[MatchedItem]
    matched_nice: List[MatchedItem]
    matched_numeric: List[MatchedItem]
    matched_enum: List[MatchedItem]
    matched_reject: List[str]

    missing_must: List[MissingItem]
    missing_nice: List[MissingItem]

    risks: List[RiskItem]

    explanation: str
    summary: str

    rule_version: str
    scored_at: str


# ==================== 规则引擎核心 ====================

class ScoringEngine:
    def __init__(self, rules: ScoringRules):
        self.rules = rules
        self._validate_rules()

    def _validate_rules(self) -> None:
        """验证规则配置"""
        if not self.rules.version:
            raise ValueError('Rule version is required')

        if not self.rules.grade_thresholds:
            raise ValueError('Grade thresholds are required')

        thresholds = self.rules.grade_thresholds
        if thresholds.A < thresholds.B or thresholds.B < thresholds.C or thresholds.C < thresholds.D:
            raise ValueError('Invalid grade thresholds: A >= B >= C >= D')

    def score(self, candidate: CandidateData) -> ScoringResult:
        """评分主函数"""
        start_time = datetime.now().isoformat()

        # 1. 技能匹配
        must_results = self._evaluate_skills(
            candidate,
            self.rules.must_skills,
            self.rules.must_weight_multiplier
        )

        nice_results = self._evaluate_skills(
            candidate,
            self.rules.nice_skills,
            self.rules.nice_weight_multiplier
        )

        # 2. 数值规则评估
        numeric_results = self._evaluate_numeric_rules(candidate)

        # 3. 枚举规则评估
        enum_results = self._evaluate_enum_rules(candidate)

        # 4. 拒绝规则检查
        reject_results = self._evaluate_reject_rules(candidate)

        # 5. 计算总分
        total_score = max(
            0,
            min(
                100,
                must_results['score'] +
                nice_results['score'] +
                numeric_results['score'] +
                enum_results['score'] -
                reject_results['penalty']
            )
        )

        # 6. 确定等级
        grade = self._determine_grade(total_score)

        # 7. 识别风险
        risks = self._identify_risks(
            candidate,
            must_results,
            reject_results,
            total_score
        )

        # 8. 生成解释
        explanation = self._generate_explanation(
            candidate,
            total_score,
            grade,
            must_results,
            nice_results,
            numeric_results,
            enum_results,
            reject_results,
            risks
        )

        summary = self._generate_summary(total_score, grade, len(risks))

        return ScoringResult(
            total_score=round(total_score, 1),
            grade=grade,

            must_score=round(must_results['score'], 1),
            nice_score=round(nice_results['score'], 1),
            numeric_score=round(numeric_results['score'], 1),
            enum_score=round(enum_results['score'], 1),
            reject_penalty=round(reject_results['penalty'], 1),

            matched_must=must_results['matched'],
            matched_nice=nice_results['matched'],
            matched_numeric=numeric_results['matched'],
            matched_enum=enum_results['matched'],
            matched_reject=reject_results['matched'],

            missing_must=must_results['missing'],
            missing_nice=nice_results['missing'],

            risks=risks,
            explanation=explanation,
            summary=summary,

            rule_version=self.rules.version,
            scored_at=start_time,
        )

    def _evaluate_skills(
        self,
        candidate: CandidateData,
        skill_rules: List[SkillRule],
        multiplier: int
    ) -> Dict[str, Any]:
        """评估技能匹配"""
        matched = []
        missing = []
        score = 0

        candidate_skills = [s.lower() for s in candidate.skills]
        raw_text_lower = candidate.raw_text.lower()

        for rule in skill_rules:
            is_matched = self._match_skill(rule, candidate_skills, raw_text_lower)

            if is_matched['matched']:
                item_score = rule.weight * multiplier
                score += item_score
                matched.append(MatchedItem(
                    name=rule.skill,
                    weight=rule.weight,
                    score=item_score,
                    matched_via=is_matched.get('via')
                ))
            else:
                potential_score = rule.weight * multiplier
                missing.append(MissingItem(
                    name=rule.skill,
                    weight=rule.weight,
                    potential_score=potential_score
                ))

        return {
            'score': score,
            'matched': matched,
            'missing': missing,
        }

    def _match_skill(
        self,
        rule: SkillRule,
        candidate_skills: List[str],
        raw_text: str
    ) -> Dict[str, Any]:
        """匹配单个技能"""
        skill_lower = rule.skill.lower()

        # 关键词匹配
        if rule.type == MatchType.KEYWORD:
            if skill_lower in candidate_skills:
                return {'matched': True, 'via': 'skills_list'}
            if skill_lower in raw_text:
                return {'matched': True, 'via': 'raw_text'}

        # 正则匹配
        if rule.type == MatchType.REGEX and rule.pattern:
            try:
                if re.search(rule.pattern, raw_text, re.IGNORECASE):
                    return {'matched': True, 'via': 'regex'}
            except re.error as e:
                print(f'Invalid regex pattern: {rule.pattern}, error: {e}')

        return {'matched': False}

    def _evaluate_numeric_rules(self, candidate: CandidateData) -> Dict[str, Any]:
        """评估数值规则"""
        matched = []
        score = 0

        for rule in self.rules.numeric_rules:
            # 获取字段值
            field_value = getattr(candidate, rule.field, None)
            if field_value is None:
                field_value = candidate.extra_fields.get(rule.field)

            if field_value is None:
                continue

            try:
                num_value = float(field_value)
            except (ValueError, TypeError):
                continue

            if self._match_numeric_rule(rule, num_value):
                item_score = rule.weight * 5
                score += item_score
                matched.append(MatchedItem(
                    name=rule.label,
                    weight=rule.weight,
                    score=item_score,
                    matched_via=f'{rule.field}={num_value}'
                ))

        return {'score': score, 'matched': matched}

    def _match_numeric_rule(self, rule: NumericRule, value: float) -> bool:
        """匹配数值规则"""
        if rule.operator == NumericOperator.GTE:
            return value >= rule.value
        elif rule.operator == NumericOperator.LTE:
            return value <= rule.value
        elif rule.operator == NumericOperator.GT:
            return value > rule.value
        elif rule.operator == NumericOperator.LT:
            return value < rule.value
        elif rule.operator == NumericOperator.EQ:
            return value == rule.value
        elif rule.operator == NumericOperator.RANGE:
            min_val, max_val = rule.value
            return min_val <= value <= max_val
        return False

    def _evaluate_enum_rules(self, candidate: CandidateData) -> Dict[str, Any]:
        """评估枚举规则"""
        matched = []
        score = 0

        for rule in self.rules.enum_rules:
            field_value = getattr(candidate, rule.field, None)
            if field_value is None:
                field_value = candidate.extra_fields.get(rule.field)

            if not field_value:
                continue

            value_lower = str(field_value).lower()
            is_matched = any(v.lower() == value_lower for v in rule.values)

            if is_matched:
                item_score = rule.weight * 5
                score += item_score
                matched.append(MatchedItem(
                    name=rule.label,
                    weight=rule.weight,
                    score=item_score,
                    matched_via=f'{rule.field}={field_value}'
                ))

        return {'score': score, 'matched': matched}

    def _evaluate_reject_rules(self, candidate: CandidateData) -> Dict[str, Any]:
        """评估拒绝规则"""
        matched = []
        penalty = 0

        raw_text_lower = candidate.raw_text.lower()

        for rule in self.rules.reject_rules:
            keyword_lower = rule.keyword.lower()
            if keyword_lower in raw_text_lower:
                matched.append(rule.keyword)
                penalty += rule.penalty

        return {'penalty': penalty, 'matched': matched}

    def _determine_grade(self, score: float) -> Grade:
        """确定等级"""
        thresholds = self.rules.grade_thresholds

        if score >= thresholds.A:
            return Grade.A
        elif score >= thresholds.B:
            return Grade.B
        elif score >= thresholds.C:
            return Grade.C
        return Grade.D

    def _identify_risks(
        self,
        candidate: CandidateData,
        must_results: Dict,
        reject_results: Dict,
        total_score: float
    ) -> List[RiskItem]:
        """识别风险点"""
        risks = []

        # 1. 拒绝关键词风险
        if reject_results['matched']:
            risks.append(RiskItem(
                type=RiskType.REJECT_KEYWORD,
                severity=RiskSeverity.HIGH,
                description=f"包含拒绝关键词: {', '.join(reject_results['matched'])}",
                impact=f"扣除 {reject_results['penalty']} 分"
            ))

        # 2. 关键技能缺失
        critical_missing = [m for m in must_results['missing'] if m.weight >= 3]
        if critical_missing:
            skills = ', '.join([m.name for m in critical_missing])
            risks.append(RiskItem(
                type=RiskType.MISSING_MUST,
                severity=RiskSeverity.HIGH,
                description=f"缺少关键技能: {skills}",
                impact="影响核心能力评估"
            ))

        # 3. 工作经验不足
        if candidate.work_years < 2:
            risks.append(RiskItem(
                type=RiskType.LOW_EXPERIENCE,
                severity=RiskSeverity.HIGH if candidate.work_years == 0 else RiskSeverity.MEDIUM,
                description=f"工作经验较少: {candidate.work_years} 年",
                impact="可能缺乏实际项目经验"
            ))

        # 4. 总分过低
        if total_score < self.rules.grade_thresholds.C:
            risks.append(RiskItem(
                type=RiskType.OTHER,
                severity=RiskSeverity.HIGH,
                description="总体匹配度较低",
                impact=f"总分 {total_score:.1f} < 及格线 {self.rules.grade_thresholds.C}"
            ))

        return risks

    def _generate_explanation(
        self,
        candidate: CandidateData,
        total_score: float,
        grade: Grade,
        must_results: Dict,
        nice_results: Dict,
        numeric_results: Dict,
        enum_results: Dict,
        reject_results: Dict,
        risks: List[RiskItem]
    ) -> str:
        """生成详细解释"""
        lines = []

        lines.append('=== 评分详情 ===\n')
        lines.append(f'总分: {total_score:.1f} / 100')
        lines.append(f'等级: {grade.value}\n')

        # Must 技能
        lines.append(f'【必备技能】得分: {must_results["score"]:.1f}')
        if must_results['matched']:
            lines.append(f"✓ 匹配 ({len(must_results['matched'])}/{len(self.rules.must_skills)}):")
            for m in must_results['matched']:
                lines.append(f'  - {m.name} (权重{m.weight}, +{m.score:.1f}分)')
        if must_results['missing']:
            lines.append(f"✗ 缺失 ({len(must_results['missing'])}):")
            for m in must_results['missing']:
                lines.append(f'  - {m.name} (权重{m.weight}, 损失{m.potential_score:.1f}分)')
        lines.append('')

        # Nice 技能
        if self.rules.nice_skills:
            lines.append(f'【加分技能】得分: {nice_results["score"]:.1f}')
            if nice_results['matched']:
                lines.append(f"✓ 匹配 ({len(nice_results['matched'])}/{len(self.rules.nice_skills)}):")
                for m in nice_results['matched']:
                    lines.append(f'  - {m.name} (权重{m.weight}, +{m.score:.1f}分)')
            else:
                lines.append('  未匹配到加分技能')
            lines.append('')

        # 拒绝关键词
        if reject_results['matched']:
            lines.append(f'【拒绝关键词】扣分: -{reject_results["penalty"]:.1f}')
            for keyword in reject_results['matched']:
                rule = next((r for r in self.rules.reject_rules if r.keyword == keyword), None)
                penalty = rule.penalty if rule else 15
                lines.append(f'  ✗ "{keyword}" (-{penalty}分)')
            lines.append('')

        # 风险点
        if risks:
            lines.append('【风险提示】')
            for risk in risks:
                icon = '⚠️' if risk.severity == RiskSeverity.HIGH else 'ℹ️'
                lines.append(f'  {icon} {risk.description}')
                lines.append(f'     → {risk.impact}')
            lines.append('')

        # 总结建议
        lines.append('【评估总结】')
        if grade == Grade.A:
            lines.append('✓ 优秀候选人，强烈推荐面试')
        elif grade == Grade.B:
            lines.append('✓ 合格候选人，建议面试')
        elif grade == Grade.C:
            lines.append('⚠ 基本合格，可考虑备选')
        else:
            lines.append('✗ 不符合岗位要求，不推荐')

        return '\n'.join(lines)

    def _generate_summary(self, score: float, grade: Grade, risk_count: int) -> str:
        """生成简短总结"""
        grade_text = {
            Grade.A: '优秀',
            Grade.B: '良好',
            Grade.C: '一般',
            Grade.D: '不合格',
        }[grade]

        risk_text = f"，{risk_count}个风险点" if risk_count > 0 else ''
        return f'评分{score:.1f}分({grade_text}){risk_text}'

    def get_version(self) -> str:
        """获取规则版本"""
        return self.rules.version

    def export_rules(self) -> Dict[str, Any]:
        """导出规则配置"""
        return asdict(self.rules)


# ==================== 工具函数 ====================

def create_default_rules(position_title: str) -> ScoringRules:
    """创建默认规则模板"""
    return ScoringRules(
        version='1.0.0',
        description=f'{position_title} 岗位评分规则',
        must_skills=[
            SkillRule(skill='JavaScript', weight=2),
            SkillRule(skill='React', weight=3),
        ],
        nice_skills=[
            SkillRule(skill='TypeScript', weight=2),
            SkillRule(skill='Node.js', weight=1),
        ],
        numeric_rules=[
            NumericRule(
                field='work_years',
                operator=NumericOperator.GTE,
                value=2,
                weight=2,
                label='工作经验≥2年'
            ),
        ],
        enum_rules=[
            EnumRule(
                field='education',
                values=['本科', '硕士', '博士'],
                weight=1,
                label='本科及以上学历'
            ),
        ],
        reject_rules=[
            RejectRule(keyword='在校生', penalty=20, description='在校学生'),
            RejectRule(keyword='实习', penalty=15, description='实习经历'),
        ],
        grade_thresholds=GradeThresholds(A=80, B=60, C=40, D=0),
        must_weight_multiplier=10,
        nice_weight_multiplier=5,
        created_at=datetime.now().isoformat(),
    )


def validate_candidate_data(data: CandidateData) -> List[str]:
    """验证候选人数据完整性"""
    errors = []

    if not data.name:
        errors.append('Missing name')
    if not data.skills:
        errors.append('Missing skills')
    if data.work_years is None:
        errors.append('Missing work_years')
    if not data.raw_text:
        errors.append('Missing raw_text')

    return errors


def compare_results(result1: ScoringResult, result2: ScoringResult) -> Dict[str, Any]:
    """比较两个评分结果"""
    return {
        'score_diff': result2.total_score - result1.total_score,
        'grade_changed': result1.grade != result2.grade,
        'version_diff': result1.rule_version != result2.rule_version,
    }


# ==================== 示例用法 ====================

if __name__ == '__main__':
    # 创建规则
    rules = create_default_rules('Frontend Developer')

    # 创建引擎
    engine = ScoringEngine(rules)

    # 候选人数据
    candidate = CandidateData(
        name='张三',
        email='zhangsan@example.com',
        phone='13800138000',
        education='硕士',
        school='清华大学',
        major='计算机科学',
        work_years=5,
        skills=['React', 'TypeScript', 'JavaScript', 'Node.js'],
        projects=['电商平台开发', '微服务后端'],
        raw_text='精通 React、TypeScript、JavaScript 和 Node.js，5年开发经验',
    )

    # 评分
    result = engine.score(candidate)

    # 输出结果
    print(f'\n候选人: {candidate.name}')
    print(f'总分: {result.total_score}')
    print(f'等级: {result.grade.value}')
    print(f'总结: {result.summary}')
    print(f'\n{result.explanation}')

    # 导出为JSON
    print('\n\nJSON输出:')
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
