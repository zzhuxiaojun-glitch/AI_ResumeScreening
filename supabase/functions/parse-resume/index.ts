import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ExtractorFactory } from "./extractor-factory.ts";

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

    // Use pluggable extractor system for structured data extraction
    const extractor = ExtractorFactory.getExtractor();
    console.log(`Using extractor: ${extractor.name} v${extractor.version}`);

    const extractionResult = await extractor.extract(rawText);

    if (!extractionResult.success) {
      console.warn("Structured extraction had issues:", extractionResult.errors);
    }

    if (extractionResult.warnings && extractionResult.warnings.length > 0) {
      console.warn("Extraction warnings:", extractionResult.warnings);
    }

    const extracted = extractionResult.data;

    // Update extraction metadata with structured extraction info
    extractionMetadata.structured = {
      success: extractionResult.success,
      confidence: extracted.extraction_confidence,
      method: extracted.extraction_method,
      warnings: extractionResult.warnings,
      errors: extractionResult.errors,
    };

    // Calculate highlights and risks based on extracted data
    const highlights: string[] = [];
    if (extracted.education && (extracted.education.includes("硕士") || extracted.education.includes("博士"))) {
      highlights.push(`High education: ${extracted.education}`);
    }
    if (extracted.work_years && extracted.work_years >= 5) {
      highlights.push(`Rich experience: ${extracted.work_years} years`);
    }
    if (extracted.skills && extracted.skills.length >= 5) {
      highlights.push(`Strong technical skills: ${extracted.skills.length} skills`);
    }

    const risks: string[] = [];
    if (!extracted.email || !extracted.phone) {
      risks.push("Missing contact information");
    }
    if (!extracted.work_years || extracted.work_years === 0) {
      risks.push("No work experience mentioned");
    }
    if (!extracted.skills || extracted.skills.length < 3) {
      risks.push("Limited technical skills");
    }

    const missing_fields: string[] = [];
    if (!extracted.name) missing_fields.push("name");
    if (!extracted.email) missing_fields.push("email");
    if (!extracted.phone) missing_fields.push("phone");
    if (!extracted.education) missing_fields.push("education");
    if (!extracted.school) missing_fields.push("school");
    if (!extracted.age) missing_fields.push("age");
    if (extracted.gender === "unknown") missing_fields.push("gender");

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
          age: extracted.age || undefined,
          gender: extracted.gender || undefined,
          work_years: extracted.work_years || 0,
          skills: extracted.skills || [],
          projects: extracted.projects || [],
          highlights: highlights.slice(0, 3),
          risks: risks.slice(0, 3),
          missing_fields: missing_fields,
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
          name: extracted.name || "",
          phone: extracted.phone || "",
          email: extracted.email || "",
          education: extracted.education || "",
          school: extracted.school || "",
          major: extracted.major || "",
          graduation_date: extracted.graduation_date || null,
          age: extracted.age || null,
          gender: extracted.gender || "unknown",
          work_years: extracted.work_years || 0,
          skills: extracted.skills || [],
          projects: extracted.projects || [],
          highlights: highlights.slice(0, 3),
          risks: risks.slice(0, 3),
          missing_fields: missing_fields,
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
