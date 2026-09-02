import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyle = () => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'occupied':
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending':
      case 'in_progress':
      case 'waiting_for_workers':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected':
      case 'expired':
      case 'overdue':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'vacant':
        return 'bg-slate-50 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getLabel = () => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStyle()}`}>
      {getLabel()}
    </span>
  );
};
