import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orgName, adminName, adminEmail } = await req.json();

    if (!orgName || !adminName || !adminEmail) {
      throw new Error("Missing required fields: orgName, adminName, and adminEmail are required.");
    }

    const supabaseUrl = Deno.env.get('ADMIN_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('ADMIN_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(`Server configuration error: Missing Supabase secrets. Url exists: ${!!supabaseUrl}, Key exists: ${!!supabaseServiceKey}`);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create Organization
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName
      })
      .select('id')
      .single();

    if (orgError || !orgData) {
      console.error("Organization creation error:", orgError);
      throw orgError || new Error("Failed to create organization.");
    }

    const org_id = orgData.id;

    // Generate Temporary Password
    const tempPassword = 'Temp-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // 2. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: adminName.split(' ')[0],
        last_name: adminName.split(' ').slice(1).join(' '),
      }
    });

    if (authError || !authData.user) {
      // Rollback org creation if user creation fails
      await supabaseAdmin.from('organizations').delete().eq('id', org_id);
      throw authError || new Error("Failed to create admin user.");
    }

    const userId = authData.user.id;

    // 3. Insert/Update Profile
    const { error: profileError } = await supabaseAdmin.from('profiles').update({
      role: 'HMS_ADMIN',
      first_name: adminName.split(' ')[0],
      last_name: adminName.split(' ').slice(1).join(' '),
      is_active: true,
      org_id: org_id,
    }).eq('id', userId);

    if (profileError) {
      console.warn("Profile update error:", profileError);
      // Fallback insert if trigger failed
      await supabaseAdmin.from('profiles').insert({
        id: userId,
        email: adminEmail,
        role: 'HMS_ADMIN',
        first_name: adminName.split(' ')[0],
        last_name: adminName.split(' ').slice(1).join(' '),
        is_active: true,
        org_id: org_id,
      });
    }

    // 4. Send Email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not provided. Organization created but email not sent.");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Organization created, but email was skipped due to missing Resend API key.",
        org_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const resend = new Resend(resendApiKey);

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to the Hostel Management System, ${adminName}!</h2>
        <p>Your organization <strong>${orgName}</strong> has been successfully created.</p>
        <p>You have been assigned as the <strong>HMS Admin</strong>.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email / Login:</strong> ${adminEmail}</p>
          <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
        </div>
        <p><strong>Important Next Steps:</strong></p>
        <ol>
          <li>Navigate to the HMS Login portal.</li>
          <li>We highly recommend you immediately click <strong>"Forgot Password"</strong> and follow the OTP flow to set your permanent secure password.</li>
          <li>Alternatively, you can log in with your temporary password and update it in your Account Settings.</li>
        </ol>
        <p>Best Regards,<br>HMS Administration Team</p>
      </div>
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Hostel Management System <onboarding@resend.dev>',
      to: [adminEmail],
      subject: "Welcome to HMS! Your Admin Credentials",
      html: htmlContent,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error("Failed to send email via Resend.");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Organization created and welcome email sent successfully.",
      org_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error("Create Organization Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || err.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
