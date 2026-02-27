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
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError) {
      return jsonResponse({ error: 'Invalid token', details: userError.message }, 401);
    }
    if (!user) {
      return jsonResponse({ error: 'Invalid token', details: 'No user' }, 401);
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let joinCode = '';
    for (let i = 0; i < 6; i++) {
      joinCode += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    const { error: updateError } = await supabaseAdmin
      .from('classes')
      .update({
        join_code: joinCode,
        join_code_created_at: new Date().toISOString(),
      })
      .eq('id', class_id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ success: true, join_code: joinCode }, 200);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
