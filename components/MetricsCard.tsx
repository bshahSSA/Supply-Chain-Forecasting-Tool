
import React from 'react';

interface MetricsCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  description: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricsCard: React.FC<MetricsCardProps> = ({ label, value, suffix, description, trend }) => {
  return (
    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl transition-all hover:border-indigo-500/50 group">
      <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1">
        <h3 className="text-3xl font-black text-slate-100 group-hover:text-indigo-400 transition-colors">{value}</h3>
        {suffix && <span className="text-sm font-bold text-slate-500">{suffix}</span>}
      </div>
      <p className="text-[10px] text-slate-500 mt-2 font-medium leading-tight">{description}</p>
    </div>
  );
};

export default MetricsCard;
