import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, User, Lock, Eye, EyeOff, ShieldCheck, Ticket, Utensils, Wrench, ArrowLeft } from 'lucide-react';
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
        setForgotSuccess('');
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
    <div className="min-h-screen bg-white md:bg-[#f3f4f6] flex items-center justify-center p-0 md:p-6 font-sans relative overflow-y-auto">
      {/* Decorative background shapes (Desktop only) */}
      <div className="hidden md:block absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
      <div className="hidden md:block absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-slate-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

      <div className="w-full max-w-[1100px] min-h-screen md:min-h-[460px] md:h-[84vh] md:max-h-[680px] bg-white rounded-none md:rounded-[2rem] shadow-none md:shadow-2xl flex flex-col md:flex-row overflow-hidden relative z-10 my-auto border-0 md:border md:border-slate-100">
        {/* Left Side - Login Form (Pixel-perfect match to screenshot) */}
        <div className="w-full md:w-[48%] lg:w-[45%] p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative bg-white min-h-screen md:min-h-0 overflow-y-auto">
          {/* Top-Right Decorative Dot Pattern */}
          <div 
            className="absolute top-0 right-0 w-36 h-36 opacity-20 pointer-events-none" 
            style={{ backgroundImage: 'radial-gradient(#64748b 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }}
          />

          <div className="w-full max-w-md mx-auto my-auto flex flex-col justify-center">
            {/* Brand Logo */}
            <div className="flex items-center justify-center md:justify-start -mt-3 sm:-mt-5 md:mt-0 mb-7 md:mb-6">
              <img 
                src="/174df9_bfc0c62f53bf48b2a6941250cfbf8a02~mv2.avif" 
                alt="AMC Logo" 
                className="h-16 sm:h-26 md:h-20 w-auto object-contain"
              />
            </div>

            {/* Header */}
            <div className="mb-7 md:mb-6 relative z-10">
              <h1 className="text-3xl sm:text-4xl md:text-3xl font-extrabold text-[#0B1437] tracking-tight mb-2">Welcome back</h1>
              <p className="text-sm text-slate-500 font-medium">Sign in to access your institutional portal</p>
            </div>

            {/* Flippable Container */}
            <div className="relative w-full" style={{ perspective: '1000px' }}>
              <div 
                className="w-full transition-transform duration-700" 
                style={{ 
                  transformStyle: 'preserve-3d', 
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  position: 'relative',
                  minHeight: '290px'
                }}
              >
                {/* FRONT FACE (Login Form) */}
                <div 
                  className={`w-full ${isFlipped ? 'pointer-events-none opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {error && (
                    <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
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
                          className="w-full bg-white pl-12 pr-4 py-3.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-xs"
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
                          className="w-full bg-white pl-12 pr-12 py-3.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-xs"
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

                    <div className="flex items-center justify-end pt-1 pb-1">
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
                      className="w-full py-4 rounded-2xl bg-[#0B1437] text-white font-bold text-sm hover:bg-[#111f54] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <span>{isLoading ? 'Authenticating...' : 'Sign in'}</span>
                      {!isLoading && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>
                </div>

                {/* BACK FACE (Forgot Password Form) */}
                <div 
                  className={`absolute inset-0 w-full ${!isFlipped ? 'pointer-events-none opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="flex items-center mb-4">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsFlipped(false);
                        setForgotError('');
                        setForgotSuccess('');
                      }}
                      className="p-1.5 -ml-1 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100 cursor-pointer"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-bold text-[#0B1437] ml-2">Reset Password</h2>
                  </div>

                  {forgotError && (
                    <div className="mb-3 p-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                      {forgotError}
                    </div>
                  )}

                  {forgotSuccess && (
                    <div className="mb-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium">
                      {forgotSuccess}
                    </div>
                  )}

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    {forgotStep === 'email' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                          Registered Email / Enrollment ID
                        </label>
                        <input
                          type="text"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="student@amc.edu or USN"
                          className="w-full bg-white px-4 py-3.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                        />
                      </div>
                    )}

                    {forgotStep === 'otp' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                          6-Digit OTP Code
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="123456"
                          className="w-full bg-white px-4 py-3.5 rounded-2xl text-sm font-mono tracking-widest text-center border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                        />
                      </div>
                    )}

                    {forgotStep === 'new-password' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                          New Password
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full bg-white px-4 py-3.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-4 rounded-2xl bg-[#0B1437] text-white font-bold text-sm hover:bg-[#111f54] cursor-pointer disabled:opacity-70"
                    >
                      {isProcessing ? 'Processing...' : forgotStep === 'email' ? 'Send Reset OTP' : forgotStep === 'otp' ? 'Verify OTP' : 'Update Password'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Bottom Footer Divider & Secure Access Note */}
            <div className="mt-10 md:mt-8 pt-4">
              <div className="relative flex items-center py-3 mb-4">
                <div className="flex-grow border-t border-slate-200/80"></div>
                <span className="flex-shrink-0 mx-4 text-xs font-semibold text-slate-400 tracking-wider">Secure Access</span>
                <div className="flex-grow border-t border-slate-200/80"></div>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-xs font-medium text-slate-500 text-center">
                  Protected by institutional authentication & secure access control.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Image & Copy (Desktop only) */}
        <div className="hidden md:flex md:w-[52%] lg:w-[55%] relative overflow-hidden bg-slate-900 flex-col justify-end p-6 lg:p-8 min-h-0">
          <img 
            src="/9383bd80-46cc-46e9-b1b5-f95b936549aa.png" 
            alt="Campus Building" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
          />
          {/* Gentle Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#061e47]/95 via-[#061e47]/30 to-transparent"></div>
          
          {/* Content Wrapper */}
          <div className="relative z-10 w-full max-w-lg mb-1">
            <h2 className="text-xl lg:text-3xl font-bold tracking-tight leading-tight mb-2 text-white drop-shadow-md">
              Streamline your<br />hostel experience.
            </h2>
            <p className="text-[11px] lg:text-xs text-blue-50 font-medium leading-relaxed mb-4 drop-shadow">
              Manage gate passes, room allocations, and maintenance requests seamlessly in one unified portal.
            </p>

            {/* Glassmorphism Feature Cards */}
            <div className="grid grid-cols-3 gap-2 lg:gap-2.5">
              {/* Card 1 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 shadow-lg transition-all hover:bg-white/15">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-2">
                  <Ticket className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-white font-bold text-xs mb-0.5">Gate Pass</h3>
                <p className="text-blue-100 text-[9px] lg:text-[10px] font-medium leading-tight opacity-90">Instant outing approvals</p>
              </div>

              {/* Card 2 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 shadow-lg transition-all hover:bg-white/15">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-2">
                  <Utensils className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-white font-bold text-xs mb-0.5">Meals</h3>
                <p className="text-blue-100 text-[9px] lg:text-[10px] font-medium leading-tight opacity-90">Daily menus & updates</p>
              </div>

              {/* Card 3 */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 shadow-lg transition-all hover:bg-white/15">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-2">
                  <Wrench className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-white font-bold text-xs mb-0.5">Issues</h3>
                <p className="text-blue-100 text-[9px] lg:text-[10px] font-medium leading-tight opacity-90">Quick maintenance requests</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
