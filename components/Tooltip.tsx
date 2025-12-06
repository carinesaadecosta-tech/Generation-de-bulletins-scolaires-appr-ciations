import React from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  return (
    <div className="group relative flex items-center">
      {children}
      <div className="absolute bottom-full left-1/2 mb-2 hidden w-max -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block z-50">
        {text}
        <div className="absolute left-1/2 top-100 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );
};
