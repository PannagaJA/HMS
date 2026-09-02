import React from 'react';
import { MoreHorizontal } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  variant: 'lime' | 'teal' | 'pink' | 'lavender';
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
    lime: 'bg-[#E8F8CE] text-emerald-950',
    teal: 'bg-[#D1F2EA] text-teal-950',
    pink: 'bg-[#FCE2E1] text-rose-950',
    lavender: 'bg-[#E0E7FF] text-indigo-950',
  };

  const barStyles = {
    lime: 'bg-emerald-800',
    teal: 'bg-teal-800',
    pink: 'bg-rose-800',
    lavender: 'bg-indigo-800',
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
