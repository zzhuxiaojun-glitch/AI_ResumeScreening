"""
规则引擎单元测试 - Python 版本

运行测试:
    python -m pytest test_scoring_engine.py -v

或使用标准库:
    python test_scoring_engine.py
"""

import unittest
from scoring_engine import (
    ScoringEngine,
    ScoringRules,
    CandidateData,
    SkillRule,
    NumericRule,
    EnumRule,
    RejectRule,
    GradeThresholds,
    MatchType,
    NumericOperator,
    Grade,
    create_default_rules,
    validate_candidate_data,
    compare_results,
)


class TestScoringEngine(unittest.TestCase):
    """规则引擎核心功能测试"""

    def setUp(self):
        """测试前准备"""
        self.rules = ScoringRules(
            version='1.0.0',
            must_skills=[
                SkillRule(skill='React', weight=3),
                SkillRule(skill='TypeScript', weight=2),
                SkillRule(skill='JavaScript', weight=2),
            ],
            nice_skills=[
                SkillRule(skill='Node.js', weight=2),
                SkillRule(skill='Docker', weight=1),
                SkillRule(skill='AWS', weight=1),
            ],
            numeric_rules=[
                NumericRule(
                    field='work_years',
                    operator=NumericOperator.GTE,
                    value=3,
                    weight=2,
                    label='3年以上工作经验'
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
                RejectRule(keyword='在校生', penalty=20),
                RejectRule(keyword='实习', penalty=15),
            ],
            grade_thresholds=GradeThresholds(A=80, B=60, C=40, D=0),
            must_weight_multiplier=10,
            nice_weight_multiplier=5,
        )

        self.excellent_candidate = CandidateData(
            name='张三',
            email='zhangsan@example.com',
            phone='13800138000',
            education='硕士',
            school='清华大学',
            major='计算机科学',
            graduation_date='2018-06-01',
            work_years=5,
            skills=['React', 'TypeScript', 'JavaScript', 'Node.js', 'Docker', 'AWS'],
            projects=['电商平台前端架构设计', '微服务后端开发'],
            raw_text='''
                姓名：张三
                邮箱：zhangsan@example.com
                学历：硕士
                工作经验：5年
                技能：React、TypeScript、JavaScript、Node.js、Docker、AWS
                项目经验：电商平台前端架构设计，微服务后端开发
            ''',
        )

        self.average_candidate = CandidateData(
            name='李四',
            email='lisi@example.com',
            phone='13900139000',
            education='本科',
            school='北京大学',
            major='软件工程',
            work_years=2,
            skills=['React', 'JavaScript'],
            projects=['企业管理系统'],
            raw_text='''
                姓名：李四
                学历：本科
                工作经验：2年
                技能：React、JavaScript
            ''',
        )

        self.rejected_candidate = CandidateData(
            name='王五',
            email='wangwu@example.com',
            phone='13700137000',
            education='本科',
            school='某大学',
            major='计算机',
            work_years=0,
            skills=['HTML', 'CSS'],
            projects=[],
            raw_text='''
                姓名：王五
                在校生，寻找实习机会
                技能：HTML、CSS基础
            ''',
        )

    def test_rule_validation(self):
        """测试规则验证"""
        # 有效规则应该通过
        engine = ScoringEngine(self.rules)
        self.assertIsNotNone(engine)

        # 缺少版本应该失败
        invalid_rules = ScoringRules(version='')
        with self.assertRaises(ValueError):
            ScoringEngine(invalid_rules)

        # 无效阈值应该失败
        invalid_rules = ScoringRules(
            version='1.0.0',
            grade_thresholds=GradeThresholds(A=50, B=60, C=70, D=0)
        )
        with self.assertRaises(ValueError):
            ScoringEngine(invalid_rules)

    def test_excellent_candidate_scoring(self):
        """测试优秀候选人评分"""
        engine = ScoringEngine(self.rules)
        result = engine.score(self.excellent_candidate)

        # 应该获得高分和A级
        self.assertGreaterEqual(result.total_score, 80)
        self.assertEqual(result.grade, Grade.A)
        self.assertEqual(result.rule_version, '1.0.0')

        # 应该匹配所有 Must 技能
        self.assertEqual(len(result.matched_must), 3)
        self.assertEqual(len(result.missing_must), 0)

        must_skills = [m.name for m in result.matched_must]
        self.assertIn('React', must_skills)
        self.assertIn('TypeScript', must_skills)
        self.assertIn('JavaScript', must_skills)

        # 应该匹配所有 Nice 技能
        self.assertEqual(len(result.matched_nice), 3)

        nice_skills = [m.name for m in result.matched_nice]
        self.assertIn('Node.js', nice_skills)
        self.assertIn('Docker', nice_skills)
        self.assertIn('AWS', nice_skills)

        # 正确的分数计算
        # React(3×10) + TypeScript(2×10) + JavaScript(2×10) = 70
        self.assertEqual(result.must_score, 70)

        # Node.js(2×5) + Docker(1×5) + AWS(1×5) = 20
        self.assertEqual(result.nice_score, 20)

        # 无拒绝关键词
        self.assertEqual(len(result.matched_reject), 0)
        self.assertEqual(result.reject_penalty, 0)

    def test_average_candidate_scoring(self):
        """测试中等候选人评分"""
        engine = ScoringEngine(self.rules)
        result = engine.score(self.average_candidate)

        # 应该获得中等分数
        self.assertGreaterEqual(result.total_score, 40)
        self.assertLess(result.total_score, 80)
        self.assertIn(result.grade, [Grade.B, Grade.C])

        # 应该部分匹配 Must 技能
        self.assertGreater(len(result.matched_must), 0)
        self.assertLess(len(result.matched_must), 3)

        # 应该有缺失的 Must 技能
        self.assertGreater(len(result.missing_must), 0)
        missing_skills = [m.name for m in result.missing_must]
        self.assertIn('TypeScript', missing_skills)

        # 应该识别风险
        self.assertGreater(len(result.risks), 0)

    def test_rejected_candidate_scoring(self):
        """测试被拒绝候选人评分"""
        engine = ScoringEngine(self.rules)
        result = engine.score(self.rejected_candidate)

        # 应该获得低分和D级
        self.assertLess(result.total_score, 40)
        self.assertEqual(result.grade, Grade.D)

        # 应该匹配拒绝关键词
        self.assertGreater(len(result.matched_reject), 0)
        self.assertIn('在校生', result.matched_reject)
        self.assertIn('实习', result.matched_reject)

        # 应该有拒绝扣分
        # "在校生"(-20) + "实习"(-15) = -35
        self.assertEqual(result.reject_penalty, 35)

        # 应该识别高风险
        self.assertGreater(len(result.risks), 2)

        # 总分不应低于0
        self.assertGreaterEqual(result.total_score, 0)

    def test_explanation_generation(self):
        """测试解释文本生成"""
        engine = ScoringEngine(self.rules)
        result = engine.score(self.excellent_candidate)

        # 应该生成详细解释
        self.assertIn('评分详情', result.explanation)
        self.assertIn('必备技能', result.explanation)
        self.assertIn('加分技能', result.explanation)
        self.assertIn('总分', result.explanation)

        # 应该生成简短总结
        self.assertTrue(result.summary)
        self.assertIn('分', result.summary)
        self.assertLess(len(result.summary), 100)

    def test_regex_matching(self):
        """测试正则表达式匹配"""
        rules_with_regex = ScoringRules(
            version='1.0.0',
            must_skills=[
                SkillRule(
                    skill='React',
                    weight=3,
                    type=MatchType.REGEX,
                    pattern=r'react|reactjs|react\.js'
                ),
            ],
            grade_thresholds=GradeThresholds(A=80, B=60, C=40, D=0),
            must_weight_multiplier=10,
            nice_weight_multiplier=5,
        )

        engine = ScoringEngine(rules_with_regex)

        candidate = CandidateData(
            name='测试',
            email='test@example.com',
            phone='13800138000',
            education='本科',
            school='某大学',
            major='计算机',
            work_years=3,
            skills=[],  # 技能列表为空
            projects=[],
            raw_text='精通 ReactJS 框架开发',  # 但在文本中存在
        )

        result = engine.score(candidate)

        # 应该通过正则匹配到
        self.assertEqual(len(result.matched_must), 1)
        self.assertEqual(result.matched_must[0].matched_via, 'regex')

    def test_numeric_operators(self):
        """测试数值规则操作符"""
        # 测试 >= 操作符
        engine = ScoringEngine(self.rules)
        candidate = CandidateData(
            **{**self.excellent_candidate.__dict__, 'work_years': 3}
        )
        result = engine.score(candidate)
        self.assertEqual(len(result.matched_numeric), 1)

        # 测试 > 操作符
        rules_with_gt = ScoringRules(
            version='1.0.0',
            numeric_rules=[
                NumericRule(
                    field='work_years',
                    operator=NumericOperator.GT,
                    value=3,
                    weight=2,
                    label='超过3年经验'
                ),
            ],
            grade_thresholds=GradeThresholds(A=80, B=60, C=40, D=0),
            must_weight_multiplier=10,
            nice_weight_multiplier=5,
        )

        engine = ScoringEngine(rules_with_gt)
        candidate = CandidateData(
            **{**self.excellent_candidate.__dict__, 'work_years': 4}
        )
        result = engine.score(candidate)
        self.assertEqual(len(result.matched_numeric), 1)

        # 测试 range 操作符
        rules_with_range = ScoringRules(
            version='1.0.0',
            numeric_rules=[
                NumericRule(
                    field='work_years',
                    operator=NumericOperator.RANGE,
                    value=(3, 7),
                    weight=2,
                    label='3-7年经验'
                ),
            ],
            grade_thresholds=GradeThresholds(A=80, B=60, C=40, D=0),
            must_weight_multiplier=10,
            nice_weight_multiplier=5,
        )

        engine = ScoringEngine(rules_with_range)
        candidate = CandidateData(
            **{**self.excellent_candidate.__dict__, 'work_years': 5}
        )
        result = engine.score(candidate)
        self.assertEqual(len(result.matched_numeric), 1)

        # 超出范围不应匹配
        candidate = CandidateData(
            **{**self.excellent_candidate.__dict__, 'work_years': 10}
        )
        result = engine.score(candidate)
        self.assertEqual(len(result.matched_numeric), 0)

    def test_edge_cases(self):
        """测试边界条件"""
        engine = ScoringEngine(self.rules)

        # 空技能列表
        candidate = CandidateData(
            **{**self.excellent_candidate.__dict__, 'skills': []}
        )
        result = engine.score(candidate)
        self.assertEqual(len(result.matched_must), 0)
        self.assertEqual(len(result.missing_must), 3)

        # 总分不应超过100
        super_candidate = CandidateData(
            **{**self.excellent_candidate.__dict__,
               'skills': ['React', 'TypeScript', 'JavaScript', 'Node.js',
                         'Docker', 'AWS', 'Python', 'Java', 'Go'],
               'work_years': 10}
        )
        result = engine.score(super_candidate)
        self.assertLessEqual(result.total_score, 100)

    def test_score_bounds(self):
        """测试分数边界"""
        engine = ScoringEngine(self.rules)

        # 极低分数不应低于0
        result = engine.score(self.rejected_candidate)
        self.assertGreaterEqual(result.total_score, 0)
        self.assertLessEqual(result.total_score, 100)


class TestUtilityFunctions(unittest.TestCase):
    """工具函数测试"""

    def test_create_default_rules(self):
        """测试创建默认规则"""
        rules = create_default_rules('Frontend Developer')

        self.assertEqual(rules.version, '1.0.0')
        self.assertIn('Frontend Developer', rules.description)
        self.assertGreater(len(rules.must_skills), 0)
        self.assertIsNotNone(rules.grade_thresholds)

    def test_validate_candidate_data(self):
        """测试候选人数据验证"""
        valid_candidate = CandidateData(
            name='张三',
            email='test@example.com',
            phone='13800138000',
            education='本科',
            school='某大学',
            major='计算机',
            work_years=3,
            skills=['Python'],
            projects=[],
            raw_text='测试文本',
        )

        errors = validate_candidate_data(valid_candidate)
        self.assertEqual(len(errors), 0)

        # 缺失字段
        incomplete_candidate = CandidateData(
            name='',
            email='test@example.com',
            phone='',
            education='',
            school='',
            major='',
            work_years=0,
            skills=[],
            projects=[],
            raw_text='',
        )

        errors = validate_candidate_data(incomplete_candidate)
        self.assertGreater(len(errors), 0)
        self.assertIn('Missing name', errors)
        self.assertIn('Missing skills', errors)

    def test_compare_results(self):
        """测试结果比较"""
        rules = create_default_rules('Test')
        engine = ScoringEngine(rules)

        candidate1 = CandidateData(
            name='高分候选人',
            email='high@example.com',
            phone='13800138000',
            education='硕士',
            school='清华',
            major='CS',
            work_years=5,
            skills=['React', 'TypeScript', 'JavaScript', 'Node.js'],
            projects=[],
            raw_text='经验丰富',
        )

        candidate2 = CandidateData(
            name='低分候选人',
            email='low@example.com',
            phone='13900139000',
            education='本科',
            school='某大学',
            major='CS',
            work_years=1,
            skills=['HTML'],
            projects=[],
            raw_text='经验较少',
        )

        result1 = engine.score(candidate1)
        result2 = engine.score(candidate2)

        comparison = compare_results(result1, result2)

        self.assertLess(comparison['score_diff'], 0)  # result2 分数更低
        self.assertTrue(comparison['grade_changed'])


class TestVersionManagement(unittest.TestCase):
    """版本管理测试"""

    def test_version_tracking(self):
        """测试版本追踪"""
        rules = create_default_rules('Test')
        rules.version = '1.0.0'

        engine = ScoringEngine(rules)

        candidate = CandidateData(
            name='测试',
            email='test@example.com',
            phone='13800138000',
            education='本科',
            school='某大学',
            major='CS',
            work_years=3,
            skills=['React'],
            projects=[],
            raw_text='测试简历',
        )

        result = engine.score(candidate)

        self.assertEqual(result.rule_version, '1.0.0')
        self.assertTrue(result.scored_at)

    def test_version_comparison(self):
        """测试版本比较"""
        rules_v1 = create_default_rules('Test')
        rules_v1.version = '1.0.0'

        rules_v2 = create_default_rules('Test')
        rules_v2.version = '2.0.0'

        engine_v1 = ScoringEngine(rules_v1)
        engine_v2 = ScoringEngine(rules_v2)

        candidate = CandidateData(
            name='测试',
            email='test@example.com',
            phone='13800138000',
            education='本科',
            school='某大学',
            major='CS',
            work_years=3,
            skills=['React'],
            projects=[],
            raw_text='测试简历',
        )

        result_v1 = engine_v1.score(candidate)
        result_v2 = engine_v2.score(candidate)

        comparison = compare_results(result_v1, result_v2)

        self.assertTrue(comparison['version_diff'])

    def test_export_rules(self):
        """测试规则导出"""
        rules = create_default_rules('Test')
        engine = ScoringEngine(rules)

        exported = engine.export_rules()

        self.assertEqual(exported['version'], rules.version)
        self.assertIsInstance(exported, dict)


class TestIntegration(unittest.TestCase):
    """集成测试"""

    def test_end_to_end_workflow(self):
        """端到端工作流测试"""
        # 1. 创建规则
        rules = create_default_rules('Full Stack Developer')

        # 2. 自定义规则
        rules.must_skills = [
            SkillRule(skill='React', weight=3),
            SkillRule(skill='Node.js', weight=3),
        ]
        rules.nice_skills = [
            SkillRule(skill='Docker', weight=2),
        ]

        # 3. 创建引擎
        engine = ScoringEngine(rules)

        # 4. 准备候选人
        candidate = CandidateData(
            name='全栈工程师',
            email='fullstack@example.com',
            phone='13800138000',
            education='硕士',
            school='清华大学',
            major='计算机',
            work_years=5,
            skills=['React', 'Node.js', 'Docker'],
            projects=['全栈项目开发'],
            raw_text='精通 React 和 Node.js，熟悉 Docker',
        )

        # 5. 评分
        result = engine.score(candidate)

        # 6. 验证结果
        self.assertIsNotNone(result)
        self.assertGreater(result.total_score, 0)
        self.assertIn(result.grade, [Grade.A, Grade.B, Grade.C, Grade.D])
        self.assertTrue(result.explanation)
        self.assertTrue(result.summary)

        # 7. 验证元数据
        self.assertEqual(result.rule_version, rules.version)
        self.assertTrue(result.scored_at)

        # 输出结果（仅在详细模式下）
        print(f'\n=== 集成测试结果 ===')
        print(f'候选人: {candidate.name}')
        print(f'总分: {result.total_score}')
        print(f'等级: {result.grade.value}')
        print(f'总结: {result.summary}')


if __name__ == '__main__':
    # 运行所有测试
    unittest.main(verbosity=2)
