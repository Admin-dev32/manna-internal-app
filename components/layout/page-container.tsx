import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageContainerSize = 'default' | 'wide' | 'narrow' | 'full';
type PageContainerSpacing = 'default' | 'compact' | 'relaxed';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  size?: PageContainerSize;
  spacing?: PageContainerSpacing;
}

const sizeClasses: Record<PageContainerSize, string> = {
  default: 'max-w-shell-content',
  wide: 'max-w-shell-wide',
  narrow: 'max-w-4xl',
  full: 'max-w-none',
};

const spacingClasses: Record<PageContainerSpacing, string> = {
  default: 'px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
  compact: 'px-4 py-4 sm:px-6 lg:px-8 lg:py-5',
  relaxed: 'px-4 py-8 sm:px-6 lg:px-8 lg:py-10',
};

export function PageContainer({ children, className, size = 'default', spacing = 'default' }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full', sizeClasses[size], spacingClasses[spacing], className)}>
      {children}
    </div>
  );
}
