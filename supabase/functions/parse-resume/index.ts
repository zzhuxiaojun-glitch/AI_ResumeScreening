import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParseRequest {
  resume_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { resume_id }: ParseRequest = await req.json();

    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resume_id)
      .single();

    if (resumeError || !resume) {
      throw new Error("Resume not found");
    }

    const { data: fileData, error: fileError } = await supabase.storage
      .from("resumes")
      .download(resume.file_path);

    if (fileError) {
      throw new Error(`File download failed: ${fileError.message}`);
    }

    let rawText = "";
    try {
      const arrayBuffer = await fileData.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      rawText = text;
    } catch (e) {
      rawText = "Failed to extract text from file";
    }

    const extracted = extractInformation(rawText);

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .insert({
        resume_id: resume.id,
        position_id: resume.position_id,
        name: extracted.name,
        phone: extracted.phone,
        email: extracted.email,
        education: extracted.education,
        school: extracted.school,
        major: extracted.major,
        graduation_date: extracted.graduation_date,
        work_years: extracted.work_years,
        skills: extracted.skills,
        projects: extracted.projects,
        highlights: extracted.highlights,
        risks: extracted.risks,
        missing_fields: extracted.missing_fields,
        raw_text: rawText,
      })
      .select()
      .single();

    if (candidateError) {
      throw new Error(`Failed to create candidate: ${candidateError.message}`);
    }

    const { data: position, error: positionError } = await supabase
      .from("positions")
      .select("*")
      .eq("id", resume.position_id)
      .single();

    if (positionError || !position) {
      throw new Error("Position not found");
    }

    const score = calculateScore(extracted, position);

    await supabase.from("scores").insert({
      candidate_id: candidate.id,
      total_score: score.total_score,
      grade: score.grade,
      must_score: score.must_score,
      nice_score: score.nice_score,
      reject_penalty: score.reject_penalty,
      scoring_details: score.scoring_details,
      explanation: score.explanation,
      matched_must: score.matched_must,
      matched_nice: score.matched_nice,
      matched_reject: score.matched_reject,
      missing_must: score.missing_must,
    });

    await supabase
      .from("resumes")
      .update({ status: "parsed" })
      .eq("id", resume_id);

    return new Response(
      JSON.stringify({ success: true, candidate_id: candidate.id }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

function extractInformation(text: string): any {
  const lowerText = text.toLowerCase();

  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : "";

  const phoneMatch = text.match(/1[3-9]\d{9}|(\+86)?[\s-]?1[3-9]\d{9}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/[\s-]/g, "") : "";

  const nameMatch = text.match(/姓名[：:]\s*([^\n\r]{2,10})/);
  const name = nameMatch ? nameMatch[1].trim() : "";

  const educationKeywords = ["博士", "硕士", "本科", "学士", "大专"];
  let education = "";
  for (const keyword of educationKeywords) {
    if (lowerText.includes(keyword)) {
      education = keyword;
      break;
    }
  }

  const schoolMatch = text.match(/([^\n]{2,15})(大学|学院|University|College)/i);
  const school = schoolMatch ? schoolMatch[0].trim() : "";

  const majorMatch = text.match(/专业[：:]\s*([^\n\r]{2,20})/);
  const major = majorMatch ? majorMatch[1].trim() : "";

  const yearMatch = text.match(/(\d{4})[年\-\.](\d{1,2})/);
  const graduation_date = yearMatch ? `${yearMatch[1]}-${yearMatch[2].padStart(2, "0")}-01` : null;

  const workYearMatch = text.match(/(\d+)\s*(年|年以上|年工作经验)/);
  const work_years = workYearMatch ? parseInt(workYearMatch[1]) : 0;

  const skillKeywords = [
    "React", "Vue", "Angular", "JavaScript", "TypeScript", "Node.js", "Python",
    "Java", "Go", "Rust", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
    "SQL", "MongoDB", "Redis", "Git", "CI/CD", "Linux", "REST", "GraphQL",
    "Express", "FastAPI", "Django", "Spring", "MySQL", "PostgreSQL",
  ];

  const skills: string[] = [];
  for (const skill of skillKeywords) {
    if (new RegExp(skill, "i").test(text)) {
      skills.push(skill);
    }
  }

  const projects: string[] = [];
  const projectMatches = text.matchAll(/项目[：:]\s*([^\n\r]{10,100})/g);
  for (const match of projectMatches) {
    projects.push(match[1].trim());
  }

  const highlights: string[] = [];
  if (education.includes("硕士") || education.includes("博士")) {
    highlights.push(`High education: ${education}`);
  }
  if (work_years >= 5) {
    highlights.push(`Rich experience: ${work_years} years`);
  }
  if (skills.length >= 5) {
    highlights.push(`Strong technical skills: ${skills.length} skills`);
  }

  const risks: string[] = [];
  if (!email || !phone) {
    risks.push("Missing contact information");
  }
  if (work_years === 0) {
    risks.push("No work experience mentioned");
  }
  if (skills.length < 3) {
    risks.push("Limited technical skills");
  }

  const missing_fields: string[] = [];
  if (!name) missing_fields.push("name");
  if (!email) missing_fields.push("email");
  if (!phone) missing_fields.push("phone");
  if (!education) missing_fields.push("education");
  if (!school) missing_fields.push("school");

  return {
    name,
    email,
    phone,
    education,
    school,
    major,
    graduation_date,
    work_years,
    skills,
    projects,
    highlights: highlights.slice(0, 3),
    risks: risks.slice(0, 3),
    missing_fields,
  };
}

function calculateScore(candidate: any, position: any): any {
  let mustScore = 0;
  let niceScore = 0;
  let rejectPenalty = 0;

  const matchedMust: string[] = [];
  const missingMust: string[] = [];
  const matchedNice: string[] = [];
  const matchedReject: string[] = [];

  const candidateSkillsLower = candidate.skills.map((s: string) => s.toLowerCase());
  const rawTextLower = candidate.raw_text?.toLowerCase() || "";

  let totalMustWeight = 0;
  for (const mustSkill of position.must_skills) {
    totalMustWeight += mustSkill.weight;
    const skillLower = mustSkill.skill.toLowerCase();
    if (
      candidateSkillsLower.includes(skillLower) ||
      rawTextLower.includes(skillLower)
    ) {
      mustScore += mustSkill.weight * 10;
      matchedMust.push(mustSkill.skill);
    } else {
      missingMust.push(mustSkill.skill);
    }
  }

  for (const niceSkill of position.nice_skills) {
    const skillLower = niceSkill.skill.toLowerCase();
    if (
      candidateSkillsLower.includes(skillLower) ||
      rawTextLower.includes(skillLower)
    ) {
      niceScore += niceSkill.weight * 5;
      matchedNice.push(niceSkill.skill);
    }
  }

  for (const keyword of position.reject_keywords) {
    const keywordLower = keyword.toLowerCase();
    if (rawTextLower.includes(keywordLower)) {
      rejectPenalty += 15;
      matchedReject.push(keyword);
    }
  }

  const totalScore = Math.max(0, Math.min(100, mustScore + niceScore - rejectPenalty));

  let grade = "D";
  const thresholds = position.grade_thresholds;
  if (totalScore >= thresholds.A) {
    grade = "A";
  } else if (totalScore >= thresholds.B) {
    grade = "B";
  } else if (totalScore >= thresholds.C) {
    grade = "C";
  }

  const explanation = `
Score Breakdown:
- Must-have skills: ${mustScore} points (matched ${matchedMust.length}/${position.must_skills.length})
- Nice-to-have skills: ${niceScore} points (matched ${matchedNice.length}/${position.nice_skills.length})
- Reject penalty: -${rejectPenalty} points (found ${matchedReject.length} reject keywords)

Total Score: ${totalScore.toFixed(1)} / 100
Grade: ${grade}

${missingMust.length > 0 ? `Missing critical skills: ${missingMust.join(", ")}` : ""}
${matchedReject.length > 0 ? `Warning: Found reject keywords: ${matchedReject.join(", ")}` : ""}
`.trim();

  return {
    total_score: totalScore,
    grade,
    must_score: mustScore,
    nice_score: niceScore,
    reject_penalty: rejectPenalty,
    scoring_details: {
      matched_must_count: matchedMust.length,
      total_must_count: position.must_skills.length,
      matched_nice_count: matchedNice.length,
      total_nice_count: position.nice_skills.length,
      reject_count: matchedReject.length,
    },
    explanation,
    matched_must: matchedMust,
    matched_nice: matchedNice,
    matched_reject: matchedReject,
    missing_must: missingMust,
  };
}
