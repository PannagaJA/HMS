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
    primary: 'bg-blue-50 text-[#0B1437]',
    secondary: 'bg-indigo-50 text-indigo-950',
    accent: 'bg-sky-50 text-sky-950',
    muted: 'bg-slate-100 text-slate-800',
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

      <div className="text-xs font-medium opacity-75 mb-1">{title}</div>
      <div className="text-3xl font-bold tracking-tight mb-4">{value}</div>

      <div className="flex items-end justify-between pt-2 border-t border-black/5">
        <div className="text-xs font-semibold opacity-80">
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
