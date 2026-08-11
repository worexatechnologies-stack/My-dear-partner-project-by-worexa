import { UserRound } from 'lucide-react';
export function Avatar({ src, name = 'Member', size = 'md', className = '' }: { src?: string | null; name?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const dimensions = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base' }[size];
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 font-bold text-rose-700 ${dimensions} ${className}`}>{src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials || <UserRound className="h-1/2 w-1/2" />}</span>;
}
