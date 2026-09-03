-- Add OTP columns to profiles table for custom password reset flow
ALTER TABLE public.profiles 
ADD COLUMN reset_otp TEXT,
ADD COLUMN reset_otp_expires_at TIMESTAMPTZ;
