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

    // Extract text using Python PDF extraction service
    let rawText = "";
    let extractionStatus = "pending";
    let extractionMetadata: any = {};
    let rawTextSource = "pymupdf";

    try {
      const pdfExtractorUrl = Deno.env.get("PDF_EXTRACTOR_URL") || "http://localhost:5000";

      // Create FormData with the PDF file
      const formData = new FormData();
      formData.append("file", fileData, "resume.pdf");

      // Call PDF extraction service
      const extractResponse = await fetch(`${pdfExtractorUrl}/extract-text`, {
        method: "POST",
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error(`PDF extraction service returned ${extractResponse.status}`);
      }

      const extractResult = await extractResponse.json();

      rawText = extractResult.text || "";
      extractionStatus = extractResult.status || "failed";
      extractionMetadata = {
        pages: extractResult.pages || 0,
        chars: extractResult.chars || 0,
        hint: extractResult.hint || "",
        extracted_at: new Date().toISOString(),
      };

      console.log(`PDF extraction: status=${extractionStatus}, pages=${extractResult.pages}, chars=${extractResult.chars}`);
    } catch (e: any) {
      console.error("PDF extraction service error:", e.message);

      // Fallback: try basic text decode as backup
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const text = new TextDecoder().decode(arrayBuffer);
        rawText = text;
        extractionStatus = "needs_review";
        extractionMetadata = {
          pages: 0,
          chars: text.length,
          hint: "Extracted using fallback method - may not be accurate",
          extracted_at: new Date().toISOString(),
        };
        rawTextSource = "fallback";
      } catch (fallbackError) {
        rawText = "";
        extractionStatus = "failed";
        extractionMetadata = {
          pages: 0,
          chars: 0,
          hint: `Extraction failed: ${e.message}`,
          extracted_at: new Date().toISOString(),
        };
      }
    }

    const extracted = extractInformation(rawText);

    const { data: existingCandidate } = await supabase.rpc(
      "find_duplicate_candidate",
      {
        p_email: extracted.email,
        p_phone: extracted.phone,
        p_position_id: resume.position_id,
      }
    );

    let candidateId: string;
    let isResubmission = false;

    if (existingCandidate) {
      candidateId = existingCandidate;
      isResubmission = true;

      await supabase.rpc("handle_candidate_resubmission", {
        p_candidate_id: candidateId,
        p_new_resume_id: resume.id,
        p_position_id: resume.position_id,
      });

      await supabase
        .from("candidates")
        .update({
          name: extracted.name || undefined,
          phone: extracted.phone || undefined,
          email: extracted.email || undefined,
          education: extracted.education || undefined,
          school: extracted.school || undefined,
          major: extracted.major || undefined,
          graduation_date: extracted.graduation_date || undefined,
          work_years: extracted.work_years,
          skills: extracted.skills,
          projects: extracted.projects,
          highlights: extracted.highlights,
          risks: extracted.risks,
          missing_fields: extracted.missing_fields,
          raw_text: rawText,
          extraction_status: extractionStatus,
          extraction_metadata: extractionMetadata,
          raw_text_source: rawTextSource,
        })
        .eq("id", candidateId);
    } else {
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
          extraction_status: extractionStatus,
          extraction_metadata: extractionMetadata,
          raw_text_source: rawTextSource,
          status: "new",
          resubmission_count: 0,
        })
        .select()
        .single();

      if (candidateError) {
        throw new Error(`Failed to create candidate: ${candidateError.message}`);
      }

      candidateId = candidate.id;
    }

    const { data: position, error: positionError } = await supabase
      .from("positions")
      .select("*")
      .eq("id", resume.position_id)
      .single();

    if (positionError || !position) {
      throw new Error("Position not found");
    }

    const score = calculateScore(extracted, position, rawText);

    if (isResubmission) {
      await supabase
        .from("scores")
        .delete()
        .eq("candidate_id", candidateId);
    }

    await supabase.from("scores").insert({
      candidate_id: candidateId,
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
      JSON.stringify({
        success: true,
        candidate_id: candidateId,
        is_resubmission: isResubmission,
      }),
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

function calculateScore(candidate: any, position: any, rawText: string): any {
  let mustScoreRaw = 0;
  let niceScoreRaw = 0;
  let rejectPenalty = 0;

  const matchedMust: string[] = [];
  const missingMust: string[] = [];
  const matchedNice: string[] = [];
  const matchedReject: string[] = [];

  const candidateSkillsLower = candidate.skills.map((s: string) => s.toLowerCase());
  const rawTextLower = rawText.toLowerCase();

  let maxMustScore = 0;
  for (const mustSkill of position.must_skills) {
    maxMustScore += mustSkill.weight * 10;
    const skillLower = mustSkill.skill.toLowerCase();
    if (
      candidateSkillsLower.includes(skillLower) ||
      rawTextLower.includes(skillLower)
    ) {
      mustScoreRaw += mustSkill.weight * 10;
      matchedMust.push(mustSkill.skill);
    } else {
      missingMust.push(mustSkill.skill);
    }
  }

  let maxNiceScore = 0;
  for (const niceSkill of position.nice_skills) {
    maxNiceScore += niceSkill.weight * 5;
    const skillLower = niceSkill.skill.toLowerCase();
    if (
      candidateSkillsLower.includes(skillLower) ||
      rawTextLower.includes(skillLower)
    ) {
      niceScoreRaw += niceSkill.weight * 5;
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

  const maxPossibleScore = maxMustScore + maxNiceScore;
  let normalizedScore = 0;

  if (maxPossibleScore > 0) {
    const rawScore = mustScoreRaw + niceScoreRaw;
    normalizedScore = (rawScore / maxPossibleScore) * 100;
  }

  const totalScore = Math.max(0, Math.min(100, normalizedScore - rejectPenalty));

  let grade = "D";
  const thresholds = position.grade_thresholds;
  if (totalScore >= thresholds.A) {
    grade = "A";
  } else if (totalScore >= thresholds.B) {
    grade = "B";
  } else if (totalScore >= thresholds.C) {
    grade = "C";
  }

  const matchedMustDetails = matchedMust.length > 0
    ? `已匹配: ${matchedMust.join(", ")}`
    : "无";
  const missingMustDetails = missingMust.length > 0
    ? `缺失: ${missingMust.join(", ")}`
    : "无";
  const matchedNiceDetails = matchedNice.length > 0
    ? `已匹配: ${matchedNice.join(", ")}`
    : "无";
  const rejectDetails = matchedReject.length > 0
    ? `发现拒绝关键词: ${matchedReject.join(", ")}`
    : "无拒绝关键词";

  const explanation = `
评分详情：

1. 必备技能 (最高 ${maxMustScore} 分，获得 ${mustScoreRaw.toFixed(1)} 分)
   - ${matchedMustDetails}
   - ${missingMustDetails}
   - 匹配度: ${matchedMust.length}/${position.must_skills.length}

2. 加分技能 (最高 ${maxNiceScore} 分，获得 ${niceScoreRaw.toFixed(1)} 分)
   - ${matchedNiceDetails}
   - 匹配度: ${matchedNice.length}/${position.nice_skills.length}

3. 拒绝关键词检查
   - ${rejectDetails}
   - 扣分: -${rejectPenalty} 分

评分计算：
- 原始得分: ${(mustScoreRaw + niceScoreRaw).toFixed(1)} / ${maxPossibleScore} 分
- 归一化得分: ${normalizedScore.toFixed(1)} / 100
- 扣除拒绝惩罚: ${normalizedScore.toFixed(1)} - ${rejectPenalty} = ${totalScore.toFixed(1)}
- 最终得分: ${totalScore.toFixed(1)} / 100
- 评级: ${grade}

${missingMust.length > 0 ? `\n⚠️ 缺少关键技能: ${missingMust.join(", ")}` : ""}
${matchedReject.length > 0 ? `\n⚠️ 警告: 简历中包含拒绝关键词: ${matchedReject.join(", ")}` : ""}
`.trim();

  return {
    total_score: parseFloat(totalScore.toFixed(1)),
    grade,
    must_score: parseFloat(mustScoreRaw.toFixed(1)),
    nice_score: parseFloat(niceScoreRaw.toFixed(1)),
    reject_penalty: rejectPenalty,
    scoring_details: {
      matched_must_count: matchedMust.length,
      total_must_count: position.must_skills.length,
      matched_nice_count: matchedNice.length,
      total_nice_count: position.nice_skills.length,
      reject_count: matchedReject.length,
      max_must_score: maxMustScore,
      max_nice_score: maxNiceScore,
      max_possible_score: maxPossibleScore,
      normalized_score: parseFloat(normalizedScore.toFixed(1)),
    },
    explanation,
    matched_must: matchedMust,
    matched_nice: matchedNice,
    matched_reject: matchedReject,
    missing_must: missingMust,
  };
}
