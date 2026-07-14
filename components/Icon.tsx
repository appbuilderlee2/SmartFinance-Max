import React from 'react';
import * as Lucide from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

// Helper to dynamically render Lucide icons
export const Icon: React.FC<IconProps> = ({ name, size = 24, className }) => {
  if (name.startsWith('emoji:')) {
    return (
      <span className={className} style={{ fontSize: size }}>
        {name.replace('emoji:', '')}
      </span>
    );
  }
  const LucideIcon = (Lucide as any)[name];
  if (!LucideIcon) return <Lucide.HelpCircle size={size} className={className} />;
  return <LucideIcon size={size} className={className} />;
};
