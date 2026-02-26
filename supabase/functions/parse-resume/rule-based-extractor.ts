/**
 * Rule-Based Structured Extractor
 *
 * A temporary implementation using regex and heuristics to extract structured data.
 * This serves as a baseline and will be replaced with AI-based extraction later.
 *
 * Design principles:
 * - Pure function, no side effects
 * - Robust error handling, never throws
 * - Returns empty/unknown for missing data
 * - Fast and lightweight
 */

import type {
  StructuredExtractor,
  StructuredData,
  ExtractionResult,
} from "./extractor-interface.ts";

export class RuleBasedExtractor implements StructuredExtractor {
  readonly name = "rule-based-extractor";
  readonly version = "1.0.0";

  extract(rawText: string): ExtractionResult {
    try {
      // Handle empty or very short text
      if (!rawText || rawText.trim().length < 10) {
        return this.createEmptyResult("Text too short or empty");
      }

      const data = this.extractFields(rawText);

      const warnings: string[] = [];
      if (!data.name) warnings.push("Name not found");
      if (!data.school) warnings.push("School not found");
      if (!data.education) warnings.push("Education not found");
      if (!data.age) warnings.push("Age not found");
      if (data.gender === "unknown") warnings.push("Gender not found");

      return {
        success: true,
        data: {
          ...data,
          extraction_method: this.name,
          extraction_timestamp: new Date().toISOString(),
          extraction_confidence: this.calculateConfidence(data, warnings),
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error: any) {
      return this.createEmptyResult(`Extraction error: ${error.message}`);
    }
  }

  private extractFields(text: string): StructuredData {
    const lowerText = text.toLowerCase();

    return {
      name: this.extractName(text),
      school: this.extractSchool(text),
      education: this.extractEducation(text, lowerText),
      age: this.extractAge(text),
      gender: this.extractGender(text, lowerText),
      phone: this.extractPhone(text),
      email: this.extractEmail(text),
      major: this.extractMajor(text),
      graduation_date: this.extractGraduationDate(text),
      work_years: this.extractWorkYears(text, lowerText),
      skills: this.extractSkills(text),
      projects: this.extractProjects(text),
    };
  }

  private extractName(text: string): string {
    // Pattern 1: 姓名: xxx or 姓名：xxx
    let match = text.match(/姓名[：:]\s*([^\n\r]{2,10})/);
    if (match) return match[1].trim();

    // Pattern 2: 个人简历 or 简历 followed by name on next line
    match = text.match(/(?:个人简历|简历)\s*\n\s*([^\n\r]{2,10})/);
    if (match) return match[1].trim();

    // Pattern 3: First line might be name if it's short (2-5 chars) and no numbers
    const firstLine = text.split("\n")[0]?.trim();
    if (firstLine && firstLine.length >= 2 && firstLine.length <= 10 && !/\d/.test(firstLine)) {
      return firstLine;
    }

    return "";
  }

  private extractSchool(text: string): string {
    // Pattern 1: University/College names
    const match = text.match(/([^\n]{2,30}(?:大学|学院|University|College|Institute))/i);
    if (match) return match[1].trim();

    // Pattern 2: 学校: xxx
    const match2 = text.match(/学校[：:]\s*([^\n\r]{2,30})/);
    if (match2) return match2[1].trim();

    // Pattern 3: Common Chinese universities
    const universities = [
      "清华", "北大", "复旦", "交大", "浙大", "南大", "武大", "中大",
      "华科", "西交", "哈工大", "同济", "北航", "南开", "天大", "中科大",
    ];

    for (const uni of universities) {
      if (text.includes(uni)) {
        // Try to extract full name
        const fullMatch = text.match(new RegExp(`([^\\n]{0,10}${uni}[^\\n]{0,20})`));
        if (fullMatch) return fullMatch[1].trim();
      }
    }

    return "";
  }

  private extractEducation(text: string, lowerText: string): string {
    const educationLevels = [
      { keyword: "博士", value: "博士" },
      { keyword: "硕士", value: "硕士" },
      { keyword: "研究生", value: "硕士" },
      { keyword: "本科", value: "本科" },
      { keyword: "学士", value: "本科" },
      { keyword: "大专", value: "大专" },
      { keyword: "专科", value: "大专" },
      { keyword: "phd", value: "博士" },
      { keyword: "doctor", value: "博士" },
      { keyword: "master", value: "硕士" },
      { keyword: "bachelor", value: "本科" },
    ];

    for (const level of educationLevels) {
      if (lowerText.includes(level.keyword)) {
        return level.value;
      }
    }

    return "";
  }

  private extractAge(text: string): number | null {
    // Pattern 1: 年龄: 25 or 年龄：25
    let match = text.match(/年龄[：:]\s*(\d{2})/);
    if (match) {
      const age = parseInt(match[1]);
      if (age >= 18 && age <= 70) return age;
    }

    // Pattern 2: 25岁
    match = text.match(/(\d{2})岁/);
    if (match) {
      const age = parseInt(match[1]);
      if (age >= 18 && age <= 70) return age;
    }

    // Pattern 3: Age: 25
    match = text.match(/age[：:]\s*(\d{2})/i);
    if (match) {
      const age = parseInt(match[1]);
      if (age >= 18 && age <= 70) return age;
    }

    // Pattern 4: Calculate from birth year (出生年月: 1995)
    match = text.match(/(?:出生|生日)[年月：:]*\s*(\d{4})/);
    if (match) {
      const birthYear = parseInt(match[1]);
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      if (age >= 18 && age <= 70) return age;
    }

    return null;
  }

  private extractGender(text: string, lowerText: string): string {
    // Pattern 1: 性别: 男/女
    let match = text.match(/性别[：:]\s*(男|女|Male|Female)/i);
    if (match) {
      const gender = match[1].toLowerCase();
      if (gender === "男" || gender === "male") return "男";
      if (gender === "女" || gender === "female") return "女";
    }

    // Pattern 2: Gender: Male/Female
    match = text.match(/gender[：:]\s*(male|female)/i);
    if (match) {
      return match[1].toLowerCase() === "male" ? "男" : "女";
    }

    // Pattern 3: Simple text search (less reliable)
    if (text.includes("性别：男") || text.includes("性别: 男")) return "男";
    if (text.includes("性别：女") || text.includes("性别: 女")) return "女";

    return "unknown";
  }

  private extractPhone(text: string): string {
    const phoneMatch = text.match(/1[3-9]\d{9}|(\+86)?[\s-]?1[3-9]\d{9}/);
    return phoneMatch ? phoneMatch[0].replace(/[\s-]/g, "") : "";
  }

  private extractEmail(text: string): string {
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    return emailMatch ? emailMatch[0] : "";
  }

  private extractMajor(text: string): string {
    const majorMatch = text.match(/专业[：:]\s*([^\n\r]{2,30})/);
    return majorMatch ? majorMatch[1].trim() : "";
  }

  private extractGraduationDate(text: string): string | null {
    const yearMatch = text.match(/(\d{4})[年\-\.](\d{1,2})/);
    if (yearMatch) {
      return `${yearMatch[1]}-${yearMatch[2].padStart(2, "0")}-01`;
    }
    return null;
  }

  private extractWorkYears(text: string, lowerText: string): number {
    const workYearMatch = text.match(/(\d+)\s*(?:年|年以上|年工作经验|years?)/i);
    return workYearMatch ? parseInt(workYearMatch[1]) : 0;
  }

  private extractSkills(text: string): string[] {
    const skillKeywords = [
      "React", "Vue", "Angular", "JavaScript", "TypeScript", "Node.js", "Python",
      "Java", "Go", "Rust", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin",
      "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Linux", "Git",
      "SQL", "MongoDB", "Redis", "PostgreSQL", "MySQL", "Oracle",
      "REST", "GraphQL", "gRPC", "Microservices",
      "Express", "FastAPI", "Django", "Spring", "Flask", "Rails",
      "HTML", "CSS", "Sass", "Webpack", "Vite", "Babel",
      "Jest", "Mocha", "Pytest", "JUnit", "Testing",
      "CI/CD", "Jenkins", "GitLab", "GitHub Actions",
      "Agile", "Scrum", "DevOps",
    ];

    const skills: string[] = [];
    for (const skill of skillKeywords) {
      if (new RegExp(skill, "i").test(text)) {
        skills.push(skill);
      }
    }

    return skills;
  }

  private extractProjects(text: string): string[] {
    const projects: string[] = [];
    const projectMatches = text.matchAll(/项目[：:]\s*([^\n\r]{10,100})/g);
    for (const match of projectMatches) {
      projects.push(match[1].trim());
    }
    return projects;
  }

  private calculateConfidence(data: StructuredData, warnings: string[]): number {
    const totalFields = 5; // name, school, education, age, gender
    const extractedFields = [
      data.name,
      data.school,
      data.education,
      data.age,
      data.gender !== "unknown" ? "yes" : "",
    ].filter((f) => f).length;

    return Math.round((extractedFields / totalFields) * 100);
  }

  private createEmptyResult(error: string): ExtractionResult {
    return {
      success: false,
      data: {
        name: "",
        school: "",
        education: "",
        age: null,
        gender: "unknown",
        phone: "",
        email: "",
        major: "",
        graduation_date: null,
        work_years: 0,
        skills: [],
        projects: [],
        extraction_method: this.name,
        extraction_timestamp: new Date().toISOString(),
        extraction_confidence: 0,
      },
      errors: [error],
    };
  }
}
