import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, ArrowRight, User, Lock, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen bg-[#F0FDF9] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-lg">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#0D3833] text-white flex items-center justify-center font-bold text-xl shadow-sm">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">HostelDesk</h1>
            <p className="text-xs text-slate-400 font-medium">Enterprise Hostel Portal</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign In</h2>
          <p className="text-xs text-slate-500 mt-1">Enter your institutional credentials to access your portal.</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in duration-150">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Username / Enrollment ID / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin, STU2026001, or email"
                className="w-full bg-slate-50 pl-11 pr-4 py-3 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 pl-11 pr-11 py-3 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-full bg-[#0D3833] text-white font-semibold text-sm hover:bg-[#064E3B] transition-all shadow-sm flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-60"
          >
            <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Protected by institutional authentication & role-based access control.
          </p>
        </div>
      </div>
    </div>
  );
};
