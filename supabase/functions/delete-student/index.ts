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

    const { student_id } = await req.json();
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
    const studentClassId = studentRow.class_id;
    if (!classData || classData.teacher_id !== user.id) {
      return jsonResponse(
        { error: "Access denied", user_id: user.id, class_id: studentClassId },
        403,
      );
    }

    const { data: brackets, error: bracketsErr } = await supabaseAdmin
      .from("student_brackets")
      .select("id")
      .eq("student_id", student_id);
    if (bracketsErr) {
      return jsonResponse({ error: bracketsErr.message }, 500);
    }
    const bracketIds = (brackets ?? []).map((b: { id: string }) => b.id);

    if (bracketIds.length > 0) {
      const { error: picksErr } = await supabaseAdmin
        .from("student_picks")
        .delete()
        .in("student_bracket_id", bracketIds);
      if (picksErr) {
        return jsonResponse({ error: picksErr.message }, 500);
      }
    }

    const { error: bracketsDelErr } = await supabaseAdmin
      .from("student_brackets")
      .delete()
      .eq("student_id", student_id);
    if (bracketsDelErr) {
      return jsonResponse({ error: bracketsDelErr.message }, 500);
    }

    const { error: studentDelErr } = await supabaseAdmin
      .from("students")
      .delete()
      .eq("id", student_id);
    if (studentDelErr) {
      return jsonResponse({ error: studentDelErr.message }, 500);
    }

    const { error: authDelErr } =
      await supabaseAdmin.auth.admin.deleteUser(student_id);
    if (authDelErr) {
      return jsonResponse({ error: authDelErr.message }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500,
    );
  }
});
