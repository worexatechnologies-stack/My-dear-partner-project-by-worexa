import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, hover = false, padding = 'md', className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-surface border border-[rgba(67,22,39,0.07)] rounded-2xl shadow-[0_2px_12px_rgba(67,22,39,0.05)] ${
        hover ? 'transition-all duration-300 hover:shadow-[0_16px_36px_rgba(67,22,39,0.10)] hover:border-[rgba(182,74,104,0.22)] hover:-translate-y-1' : ''
      } ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-lg font-bold text-ink font-display ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
