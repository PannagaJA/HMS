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
    const { action, email, otp, newPassword } = await req.json();

    if (!action || !email) {
      throw new Error("Missing required fields: action and email are required.");
    }

    const supabaseUrl = Deno.env.get('ADMIN_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('ADMIN_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration error: Missing Supabase secrets.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. ACTION: request_otp
    if (action === 'request_otp') {
      // Check if user exists
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name')
        .eq('email', email.trim());

      if (profileError || !profiles || profiles.length === 0) {
        throw new Error("No user found with this email address.");
      }

      const userProfile = profiles[0];
      
      // Generate 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Calculate expiry (10 mins from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // Save OTP to profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          reset_otp: generatedOtp,
          reset_otp_expires_at: expiresAt.toISOString()
        })
        .eq('id', userProfile.id);

      if (updateError) throw updateError;

      // Send Email via Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      if (!resendApiKey) {
        throw new Error("Resend API key not configured on the server.");
      }

      const resend = new Resend(resendApiKey);

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-w-md mx-auto p-6 bg-white border border-gray-200 rounded-lg">
          <h2 style="color: #0B1437; margin-bottom: 20px;">Password Reset</h2>
          <p>Hi ${userProfile.first_name || 'there'},</p>
          <p>You recently requested to reset the password for your Hostel Management System account.</p>
          <p>Here is your 6-digit verification code:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0B1437; font-family: monospace;">
              ${generatedOtp}
            </span>
          </div>
          <p style="color: #64748b; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `;

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'Hostel Management System <onboarding@resend.dev>',
        to: [email],
        subject: "Your Password Reset OTP - HMS",
        html: htmlContent,
      });

      if (emailError) {
        console.error("Resend error:", emailError);
        throw new Error("Failed to send email via Resend.");
      }

      return new Response(JSON.stringify({ success: true, message: "If this email is registered, an OTP has been sent." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. ACTION: verify_and_update
    if (action === 'verify_and_update') {
      if (!otp || !newPassword) {
        throw new Error("OTP and new password are required.");
      }

      // Check OTP in database
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, reset_otp, reset_otp_expires_at')
        .eq('email', email.trim());

      if (profileError || !profiles || profiles.length === 0) {
        throw new Error("Invalid or expired OTP.");
      }

      const userProfile = profiles[0];

      if (userProfile.reset_otp !== otp.trim()) {
        throw new Error("Invalid OTP.");
      }

      if (new Date() > new Date(userProfile.reset_otp_expires_at)) {
        throw new Error("OTP has expired. Please request a new one.");
      }

      // Update the user's password using Auth Admin API
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        userProfile.id,
        { password: newPassword }
      );

      if (updateAuthError) throw updateAuthError;

      // Clear the OTP so it can't be reused
      await supabaseAdmin
        .from('profiles')
        .update({ 
          reset_otp: null,
          reset_otp_expires_at: null
        })
        .eq('id', userProfile.id);

      return new Response(JSON.stringify({ success: true, message: "Password updated successfully." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error("Invalid action specified.");

  } catch (error: any) {
    console.error("Function error:", error);
    // Return 200 so the frontend supabase-js client doesn't throw a generic FunctionsHttpError
    return new Response(JSON.stringify({ error: error.message || error.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
})
