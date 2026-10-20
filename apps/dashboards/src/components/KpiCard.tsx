import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  badge?: string;
  badgeColor?: 'green' | 'blue' | 'purple' | 'amber';
  icon?: React.ReactNode;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subValue,
  badge,
  badgeColor = 'green',
  icon,
}) => {
  const badgeClasses = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }[badgeColor];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="flex items-baseline space-x-2">
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>
      {subValue && <div className="mt-1 text-xs text-slate-400">{subValue}</div>}
    </div>
  );
};
