import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface CardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  variant?: 'default' | 'flat' | 'elevated' | 'gov' | 'dark';
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  padding = 'md',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3.5',
    md: 'p-5',
    lg: 'p-6',
  };

  const variantStyles = {
    default: 'bg-white border border-slate-200/90 shadow-xs rounded-xl text-slate-900',
    flat: 'bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900',
    elevated: 'bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-xl text-slate-900',
    gov: 'bg-white border border-slate-200 shadow-xs rounded-xl relative overflow-hidden',
    dark: 'bg-[#001D33] text-white border border-slate-800 shadow-md rounded-xl',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};
