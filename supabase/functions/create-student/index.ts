import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const { join_code, full_name, username, password } = await req.json();

    // Validate input
    if (!join_code || !full_name || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 1: Validate join_code and fetch class id
    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('join_code', join_code.toUpperCase())
      .maybeSingle();

    if (classError || !classData) {
      return new Response(
        JSON.stringify({ error: 'Invalid join code' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Check if username already exists in class
    const { data: existingUsername } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('class_id', classData.id)
      .eq('username', username)
      .maybeSingle();

    if (existingUsername) {
      return new Response(
        JSON.stringify({ error: 'Username already taken' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 3: Create auth user via admin API
    const studentEmail = `${username}@class.student`;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: studentEmail,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create auth user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 4: Insert row into public.students
    const { error: insertError } = await supabaseAdmin
      .from('students')
      .insert({
        id: authData.user.id,
        class_id: classData.id,
        username: username,
        name: full_name.trim(),
      });

    if (insertError) {
      // Clean up: delete the auth user if student insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: insertError.message || 'Failed to create student profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 5: Return success
    return new Response(
      JSON.stringify({
        student_id: authData.user.id,
        class_id: classData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
