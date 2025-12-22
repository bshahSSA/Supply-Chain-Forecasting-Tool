
import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
  title?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, title }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block ml-2 group">
      <HelpCircle 
        size={14} 
        className="text-slate-500 hover:text-indigo-400 cursor-help transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />
      {isVisible && (
        <div className="absolute z-[100] w-64 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl text-[11px] text-slate-300 left-1/2 -translate-x-1/2 bottom-full mb-2 animate-in fade-in zoom-in duration-200">
          {title && <div className="font-bold text-white mb-1 border-b border-slate-700 pb-1">{title}</div>}
          <div className="leading-relaxed">{content}</div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-r border-b border-slate-700 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
