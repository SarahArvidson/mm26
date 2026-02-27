import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized', details: 'Missing or invalid Authorization header' }, 401);
    }
    const token = authHeader.slice(7);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse(
        { error: 'Unauthorized', details: userError?.message ?? 'no user' },
        401
      );
    }

    const { class_id } = await req.json();
    if (!class_id) {
      return jsonResponse({ error: 'class_id required' }, 400);
    }

    const { data: teacherRow, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (teacherError || !teacherRow) {
      return jsonResponse({ error: 'Not a teacher', user_id: user.id }, 403);
    }

    const { data: classRow, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('id', class_id)
      .eq('teacher_id', user.id)
      .maybeSingle();
    if (classError || !classRow) {
      return jsonResponse({ error: 'Access denied', user_id: user.id, class_id }, 403);
    }

    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, name, username')
      .eq('class_id', class_id)
      .order('name', { ascending: true });

    if (studentsError) {
      return jsonResponse({ error: studentsError.message }, 500);
    }

    return jsonResponse({ students: students ?? [] }, 200);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
