import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateTempPassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const num = "0123456789";
  let out = "";
  out += upper[Math.floor(Math.random() * upper.length)];
  out += lower[Math.floor(Math.random() * lower.length)];
  out += num[Math.floor(Math.random() * num.length)];
  const all = upper + lower + num;
  for (let i = 0; i < 9; i++) {
    out += all[Math.floor(Math.random() * all.length)];
  }
  return out.split("").sort(() => Math.random() - 0.5).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(
        {
          error: "Unauthorized",
          details: "Missing or invalid Authorization header",
        },
        401,
      );
    }
    const token = authHeader.slice(7);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse(
        { error: "Unauthorized", details: userError?.message ?? "no user" },
        401,
      );
    }

    const body = await req.json();
    const student_id = body?.student_id as string | undefined;
    const new_password = body?.new_password as string | undefined;
    if (!student_id) {
      return jsonResponse({ error: "student_id required" }, 400);
    }

    const { data: teacherRow, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (teacherError || !teacherRow) {
      return jsonResponse({ error: "Not a teacher", user_id: user.id }, 403);
    }

    const { data: studentRow, error: studentErr } = await supabaseAdmin
      .from("students")
      .select("id, class_id, classes!inner(teacher_id)")
      .eq("id", student_id)
      .maybeSingle();
    if (studentErr) {
      return jsonResponse({ error: studentErr.message }, 500);
    }
    if (!studentRow) {
      return jsonResponse({ error: "Student not found" }, 404);
    }
    const classData = studentRow.classes as { teacher_id: string } | null;
    if (!classData || classData.teacher_id !== user.id) {
      return jsonResponse(
        { error: "Access denied", user_id: user.id, class_id: studentRow.class_id },
        403,
      );
    }

    let tempPassword: string;
    if (new_password != null && new_password !== "") {
      if (new_password.length < 8) {
        return jsonResponse(
          { error: "new_password must be at least 8 characters" },
          400,
        );
      }
      tempPassword = new_password;
    } else {
      tempPassword = generateTempPassword();
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      student_id,
      { password: tempPassword },
    );
    if (updateErr) {
      return jsonResponse({ error: updateErr.message }, 500);
    }

    return jsonResponse({ success: true, temp_password: tempPassword }, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500,
    );
  }
});
