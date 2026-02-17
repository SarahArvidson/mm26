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
    // Diagnostic log: check if authorization header exists (this endpoint does not require it)
    const hasAuthHeader = req.headers.get('authorization') !== null;
    
    // Get Supabase admin client (uses service role, does not require request auth)
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
    const { username } = await req.json();
    
    // Temporary diagnostic log
    console.log('resolve-student called', { hasAuthHeader, username });

    // Validate and trim username
    if (!username || typeof username !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Username is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const normalizedUsername = username.trim();

    // Query students with class info using admin client (bypasses RLS)
    const { data: matches, error: queryError } = await supabaseAdmin
      .from('students')
      .select('id, auth_email, class_id, classes(name)')
      .eq('username', normalizedUsername);

    if (queryError) {
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Transform matches to include class_name
    const transformedMatches = (matches || []).map((match: any) => ({
      id: match.id,
      auth_email: match.auth_email,
      class_id: match.class_id,
      class_name: match.classes?.name || 'Class',
    }));

    // Return matches (empty array if no matches)
    return new Response(
      JSON.stringify({
        success: true,
        matches: transformedMatches,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
