import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ImportRequest {
  config_id: string;
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

    const { config_id }: ImportRequest = await req.json();

    const { data: config, error: configError } = await supabase
      .from("email_configs")
      .select("*")
      .eq("id", config_id)
      .single();

    if (configError || !config) {
      throw new Error("Email config not found");
    }

    let importedCount = 0;

    const mockResumes = [
      {
        fileName: "resume_candidate1.pdf",
        content: `
姓名：张三
邮箱：zhangsan@example.com
电话：13800138000
学历：硕士
学校：清华大学计算机学院
专业：计算机科学与技术
毕业时间：2020年6月
工作经验：3年工作经验

技能：
- React
- TypeScript
- Node.js
- Python
- Docker
- AWS
- MySQL
- Redis

项目经验：
项目：电商平台前端开发，负责整体前端架构设计和核心模块开发
项目：微服务系统后端开发，使用Node.js和Docker构建高可用服务
        `.trim(),
      },
      {
        fileName: "resume_candidate2.pdf",
        content: `
姓名：李四
邮箱：lisi@example.com
电话：13900139000
学历：本科
学校：北京大学软件学院
专业：软件工程
毕业时间：2021年7月
工作经验：2年工作经验

技能：
- Vue
- JavaScript
- Java
- Spring
- MySQL
- Git

项目经验：
项目：企业管理系统，负责前端页面开发和API对接
项目：移动端H5应用开发，使用Vue框架开发响应式页面
        `.trim(),
      },
    ];

    for (const mockResume of mockResumes) {
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.txt`;
      const filePath = `resumes/${fileName}`;

      const blob = new Blob([mockResume.content], { type: "text/plain" });
      const file = new File([blob], fileName);

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      const { data: resumeData, error: resumeError } = await supabase
        .from("resumes")
        .insert({
          position_id: config.position_id,
          file_name: mockResume.fileName,
          file_path: filePath,
          file_size: mockResume.content.length,
          file_type: "txt",
          upload_source: "email",
          status: "pending",
        })
        .select()
        .single();

      if (resumeError) {
        console.error("Resume insert error:", resumeError);
        continue;
      }

      const parseUrl = `${supabaseUrl}/functions/v1/parse-resume`;
      await fetch(parseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resume_id: resumeData.id }),
      });

      importedCount++;
    }

    await supabase
      .from("email_configs")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", config_id);

    return new Response(
      JSON.stringify({ success: true, count: importedCount }),
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
