import React from 'react';
import { MoreHorizontal } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  variant: 'primary' | 'secondary' | 'accent' | 'muted';
  icon: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change = '+2.5% This Month',
  variant,
  icon,
}) => {
  const variantStyles = {
    primary: 'bg-blue-50/90 text-[#0B1437] border border-blue-200/80 shadow-xs',
    secondary: 'bg-indigo-50/90 text-indigo-950 border border-indigo-200/80 shadow-xs',
    accent: 'bg-sky-50/90 text-sky-950 border border-sky-200/80 shadow-xs',
    muted: 'bg-slate-100/90 text-slate-900 border border-slate-200/80 shadow-xs',
  };

  const barStyles = {
    primary: 'bg-blue-600',
    secondary: 'bg-indigo-600',
    accent: 'bg-sky-600',
    muted: 'bg-slate-400',
  };

  return (
    <div className={`p-6 rounded-3xl transition-all duration-200 hover:shadow-md ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center">
          {icon}
        </div>
        <button className="p-1 hover:bg-black/5 rounded-full transition-colors">
          <MoreHorizontal className="w-5 h-5 opacity-60" />
        </button>
      </div>

      <div className="text-xs font-bold text-slate-700 mb-1">{title}</div>
      <div className="text-3xl font-extrabold tracking-tight mb-4 text-slate-900">{value}</div>

      <div className="flex items-end justify-between pt-2 border-t border-black/10">
        <div className="text-xs font-bold text-slate-700">
          {change}
        </div>
        <div className="flex items-end gap-1 h-7">
          <div className={`w-1.5 h-3 rounded-full opacity-40 ${barStyles[variant]}`} />
          <div className={`w-1.5 h-5 rounded-full opacity-60 ${barStyles[variant]}`} />
          <div className={`w-1.5 h-7 rounded-full ${barStyles[variant]}`} />
        </div>
      </div>
    </div>
  );
};
