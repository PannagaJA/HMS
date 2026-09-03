import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, User, Lock, Eye, EyeOff, ShieldCheck, Ticket, Utensils, Wrench, ArrowLeft, Mail, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const Login: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password States
  const [isFlipped, setIsFlipped] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'new-password'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setError('');
    try {
      const loggedInUser = await login(username.trim(), password);
      // Explicit programmatic navigation based on role
      switch (loggedInUser?.role) {
        case 'ADMIN':
          navigate('/admin/dashboard', { replace: true });
          break;
        case 'WARDEN':
          navigate('/warden/dashboard', { replace: true });
          break;
        case 'SECURITY':
          navigate('/security/scanner', { replace: true });
          break;
        case 'STUDENT':
          navigate('/student/dashboard', { replace: true });
          break;
        default:
          navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: any) {
      console.error('Login submit error:', err);
      setError(
        err.response?.data?.detail || 
        err.response?.data?.error || 
        'Invalid username or password. Please check your credentials.'
      );
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setIsProcessing(true);

    try {
      if (forgotStep === 'email') {
        if (!resetEmail.trim()) throw new Error('Please enter your email.');
        const { data, error } = await supabase.functions.invoke('reset-password', {
          body: { action: 'request_otp', email: resetEmail.trim() }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        setForgotSuccess('OTP sent to your email.');
        setForgotStep('otp');
      } 
      else if (forgotStep === 'otp') {
        if (!otp.trim()) throw new Error('Please enter the OTP.');
        setForgotSuccess(''); // clear previous success message when moving to next step
        setForgotStep('new-password');
      } 
      else if (forgotStep === 'new-password') {
        if (!newPassword.trim()) throw new Error('Please enter a new password.');
        if (newPassword.length < 6) throw new Error('Password must be at least 6 characters long.');
        
        const { data, error } = await supabase.functions.invoke('reset-password', {
          body: { 
            action: 'verify_and_update', 
            email: resetEmail.trim(), 
            otp: otp.trim(), 
            newPassword: newPassword 
          }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setForgotSuccess('Password updated successfully! You can now log in.');
        setTimeout(() => {
          setIsFlipped(false);
          setForgotStep('email');
          setResetEmail('');
          setOtp('');
          setNewPassword('');
          setForgotSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setForgotError(err.message || 'An error occurred during password reset.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-0 md:p-6 font-sans relative overflow-hidden">
      
      {/* Decorative background shapes */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-slate-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

      <div className="w-full max-w-[1200px] bg-white md:rounded-[2rem] shadow-2xl flex flex-col md:flex-row overflow-hidden min-h-screen md:min-h-[760px] relative z-10">
        
        {/* Left Side - Login Form */}
        <div className="w-full md:w-[45%] p-8 sm:p-12 lg:p-14 xl:p-16 flex flex-col justify-center relative bg-white min-h-screen md:min-h-0">
          {/* Subtle dot pattern in the top right of the left panel */}
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

          <div className="w-full max-w-md mx-auto">
            {/* Brand Logo */}
            <div className="flex items-center mb-10 md:mb-12">
              <img 
                src="/174df9_bfc0c62f53bf48b2a6941250cfbf8a02~mv2.avif" 
                alt="AMC Logo" 
                className="h-14 md:h-20 w-auto object-contain"
              />
            </div>

            {/* Header */}
            <div className="mb-8 relative z-10">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0B1437] tracking-tight mb-2.5">Welcome back</h1>
              <p className="text-[15px] text-slate-500 font-medium">Sign in to access your institutional portal</p>
            </div>

            {/* Flippable Container */}
            <div className="relative w-full" style={{ perspective: '1000px' }}>
              <div 
                className="w-full transition-transform duration-700" 
                style={{ 
                  transformStyle: 'preserve-3d', 
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  position: 'relative',
                  minHeight: '380px' // Keep a consistent height to prevent layout jumps
                }}
              >
                
                {/* FRONT FACE (Login Form) */}
                <div 
                  className={`absolute inset-0 w-full ${isFlipped ? 'pointer-events-none' : ''}`}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                      {error}
                    </div>
                  )}

            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Username / Enrollment ID / Email
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin, STU2026001, or email"
                    className="w-full bg-white pl-12 pr-4 py-3.5 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white pl-12 pr-12 py-3.5 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 pb-2">
                <button 
                  type="button" 
                  onClick={() => setIsFlipped(true)}
                  className="text-sm font-bold text-[#0B1437] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl bg-[#0B1437] text-white font-semibold text-sm hover:bg-[#111f54] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span>{isLoading ? 'Authenticating...' : 'Sign in'}</span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>

          {/* BACK FACE (Forgot Password Form) */}
          <div 
            className={`absolute inset-0 w-full ${!isFlipped ? 'pointer-events-none' : ''}`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="flex items-center mb-6">
              <button 
                onClick={() => {
                  setIsFlipped(false);
                  setForgotError('');
                  setForgotSuccess('');
                }}
                className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-[#0B1437] ml-2">Reset Password</h2>
            </div>

            {forgotError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                {forgotError}
              </div>
            )}
            
            {forgotSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-100 text-green-600 text-sm font-medium">
                {forgotSuccess}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-5">
              {forgotStep === 'email' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                    Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. name@university.edu"
                      className="w-full bg-white pl-12 pr-4 py-3.5 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-sm"
                    />
                  </div>
                </div>
              )}

              {forgotStep === 'otp' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                    Enter OTP
                  </label>
                  <div className="relative">
                    <Key className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="w-full bg-white pl-12 pr-4 py-3.5 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-sm font-mono tracking-widest"
                    />
                  </div>
                </div>
              )}

              {forgotStep === 'new-password' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white pl-12 pr-12 py-3.5 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 mt-4 rounded-xl bg-[#0B1437] text-white font-semibold text-sm hover:bg-[#111f54] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span>
                  {isProcessing 
                    ? 'Processing...' 
                    : forgotStep === 'email' 
                      ? 'Send Reset OTP' 
                      : forgotStep === 'otp' 
                        ? 'Verify OTP' 
                        : 'Update Password'}
                </span>
                {!isProcessing && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>

          </div> {/* End inner flip container */}
        </div> {/* End outer perspective container */}

            <div className="mt-10 md:mt-12">
               <div className="relative flex items-center py-4 mb-4">
                 <div className="flex-grow border-t border-slate-200"></div>
                 <span className="flex-shrink-0 mx-4 text-xs font-semibold text-slate-400 tracking-wider">Secure Access</span>
                 <div className="flex-grow border-t border-slate-200"></div>
               </div>
               
               <div className="flex items-center justify-center gap-2 text-slate-500">
                 <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                 <p className="text-[12px] font-medium whitespace-normal md:whitespace-nowrap text-center">
                   Protected by institutional authentication & secure access control.
                 </p>
               </div>
            </div>
          </div>
        </div>

        {/* Right Side - Image & Copy */}
        <div className="hidden md:flex md:w-[55%] relative overflow-hidden bg-slate-900 flex-col justify-center p-12 lg:p-16">
          <img 
            src="/9383bd80-46cc-46e9-b1b5-f95b936549aa.png" 
            alt="Campus Building" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
          />
          {/* Gentle Gradient Overlay for text readability, no mix-blend-multiply so image stays bright */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#061e47]/95 via-[#061e47]/30 to-transparent"></div>
          
          {/* Content Wrapper */}
          <div className="relative z-10 w-full max-w-lg mt-auto mb-6">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-5 text-white drop-shadow-md">
              Streamline your<br />hostel experience.
            </h2>
            <p className="text-[17px] text-blue-50 font-medium leading-relaxed mb-10 drop-shadow">
              Manage gate passes, room allocations, and maintenance requests seamlessly in one unified portal.
            </p>

            {/* Glassmorphism Feature Cards */}
            <div className="grid grid-cols-3 gap-4">
              
              {/* Card 1 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-xl transition-all hover:bg-white/15">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Ticket className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-sm mb-1.5">Gate Pass</h3>
                <p className="text-blue-100 text-xs font-medium leading-snug opacity-90">Instant outing approvals</p>
              </div>

              {/* Card 2 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-xl transition-all hover:bg-white/15">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Utensils className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-sm mb-1.5">Meals</h3>
                <p className="text-blue-100 text-xs font-medium leading-snug opacity-90">Daily menus & updates</p>
              </div>

              {/* Card 3 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-xl transition-all hover:bg-white/15">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-sm mb-1.5">Issues</h3>
                <p className="text-blue-100 text-xs font-medium leading-snug opacity-90">Quick maintenance requests</p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
