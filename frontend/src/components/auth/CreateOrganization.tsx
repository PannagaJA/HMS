import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Building, User, Mail, Globe, ArrowLeft, CheckCircle2, ShieldCheck, Ticket, Utensils, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const CreateOrganization: React.FC = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    orgName: '',
    adminName: '',
    adminEmail: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orgName || !formData.adminName || !formData.adminEmail) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setIsProcessing(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create organization');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
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
        {/* Left Side - Form */}
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
              <h1 className="text-3xl sm:text-4xl md:text-3xl font-extrabold text-[#0B1437] tracking-tight mb-2">Create Workspace</h1>
              <p className="text-sm text-slate-500 font-medium">Set up your institution's HMS portal</p>
            </div>

            <div className="relative w-full">
              {success ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-[#0B1437] mb-2">Workspace Created!</h2>
                  <p className="text-sm text-slate-600 mb-6">
                    Your organization <strong>{formData.orgName}</strong> has been set up successfully. We've sent an email to <strong>{formData.adminEmail}</strong> with your temporary login credentials.
                  </p>
                  <Link 
                    to="/login"
                    className="w-full py-4 rounded-2xl bg-[#0B1437] text-white font-bold text-sm hover:bg-[#111f54] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Go to Login <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                  {error && (
                    <div className="mb-3 p-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                      Organization Name *
                    </label>
                    <div className="relative">
                      <Building className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        name="orgName"
                        required
                        value={formData.orgName}
                        onChange={handleChange}
                        placeholder="e.g. Stanford University"
                        className="w-full bg-white pl-12 pr-4 py-3.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                      Admin Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        name="adminName"
                        required
                        value={formData.adminName}
                        onChange={handleChange}
                        placeholder="Jane Doe"
                        className="w-full bg-white pl-12 pr-4 py-3.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                      Admin Email *
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        name="adminEmail"
                        required
                        value={formData.adminEmail}
                        onChange={handleChange}
                        placeholder="admin@example.com"
                        className="w-full bg-white pl-12 pr-4 py-3.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437] transition-all placeholder:text-slate-400 shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-4 rounded-2xl bg-[#0B1437] text-white font-bold text-sm hover:bg-[#111f54] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <span>{isProcessing ? 'Setting up Workspace...' : 'Create Workspace'}</span>
                      {!isProcessing && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Bottom Footer Divider */}
            <div className="mt-8 pt-4">
              <div className="relative flex items-center py-3 mb-4">
                <div className="flex-grow border-t border-slate-200/80"></div>
                <Link to="/login" className="flex-shrink-0 mx-4 text-xs font-bold text-[#0B1437] hover:underline flex items-center transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Login
                </Link>
                <div className="flex-grow border-t border-slate-200/80"></div>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-xs font-medium text-slate-500 text-center">
                  Protected by institutional authentication
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
