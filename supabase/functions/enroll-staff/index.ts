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
    const { name, email, phone, role, designation, experience } = await req.json();

    if (!email || !role || !name) {
      throw new Error("Missing required fields: email, role, and name are required.");
    }

    const supabaseUrl = Deno.env.get('ADMIN_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('ADMIN_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(`Server configuration error: Missing Supabase secrets. Url exists: ${!!supabaseUrl}, Key exists: ${!!supabaseServiceKey}`);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Generate Temporary Password
    const tempPassword = 'Temp-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Fetch the org_id of the admin making this request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user: adminUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
    if (verifyError || !adminUser) throw new Error("Invalid admin token");
    
    const { data: adminProfile } = await supabaseAdmin.from('profiles').select('org_id').eq('id', adminUser.id).single();
    const org_id = adminProfile?.org_id;
    if (!org_id) throw new Error("Admin has no organization assigned");

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' '),
      }
    });

    if (authError || !authData.user) {
      throw authError || new Error("Failed to create auth user.");
    }

    const userId = authData.user.id;

    // 2. Insert into Profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').update({
      role: role.toUpperCase(),
      first_name: name.split(' ')[0],
      last_name: name.split(' ').slice(1).join(' '),
      phone: phone || '',
      is_active: true,
      org_id: org_id,
    }).eq('id', userId);

    if (profileError) {
      console.warn("Profile update error:", profileError);
      // Fallback insert if trigger failed
      await supabaseAdmin.from('profiles').insert({
        id: userId,
        email: email,
        role: role.toUpperCase(),
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' '),
        phone: phone || '',
        is_active: true,
        org_id: org_id,
      });
    }

    // 3. Send Email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not provided. User created but email not sent.");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "User created, but email was skipped due to missing Resend API key.",
        userId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const resend = new Resend(resendApiKey);

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to the Hostel Management System, ${name}!</h2>
        <p>You have been enrolled as a <strong>${role}</strong>.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email / Login:</strong> ${email}</p>
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
      to: [email],
      subject: "Your HMS Account Credentials & Temporary Password",
      html: htmlContent,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error("Failed to send email via Resend.");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "User created and email sent successfully.",
      userId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error("Enroll Staff Error:", err);
    // Returning 200 with success: false so the frontend can read the exact error without a generic HTTP error
    return new Response(JSON.stringify({ success: false, error: err.message || err.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
