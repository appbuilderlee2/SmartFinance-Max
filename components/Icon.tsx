import React from 'react';
import {
  Banknote,
  Book,
  Briefcase,
  Building2,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  Heart,
  HelpCircle,
  Home,
  Image,
  Music,
  Pill,
  Plane,
  ShoppingBag,
  Stethoscope,
  Tag,
  Train,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export const CATEGORY_ICON_NAMES = [
  'Utensils', 'Car', 'Film', 'ShoppingBag', 'Home', 'Heart', 'Tag', 'Briefcase',
  'Gift', 'Plane', 'Coffee', 'Book', 'Music', 'Gamepad2', 'Dumbbell', 'Pill',
  'Wallet', 'CreditCard', 'Banknote', 'TrendingUp', 'Building2', 'Bus', 'Train',
] as const;

const ICONS: Record<string, LucideIcon> = {
  Banknote,
  Book,
  Briefcase,
  Building2,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  Heart,
  HelpCircle,
  Home,
  Image,
  Music,
  Pill,
  Plane,
  ShoppingBag,
  Stethoscope,
  Tag,
  Train,
  TrendingUp,
  Utensils,
  Wallet,
};

export const isSupportedIcon = (name: string): boolean => name.startsWith('emoji:') || name in ICONS;

export const Icon: React.FC<IconProps> = ({ name, size = 24, className }) => {
  if (name.startsWith('emoji:')) {
    return (
      <span className={className} style={{ fontSize: size }}>
        {name.replace('emoji:', '')}
      </span>
    );
  }
  const LucideIcon = ICONS[name];
  if (!LucideIcon) return <HelpCircle size={size} className={className} />;
  return <LucideIcon size={size} className={className} />;
};
