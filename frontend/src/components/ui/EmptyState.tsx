import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-steel-100 bg-paper px-6 py-14 text-center">
      <h3 className="text-base text-asphalt">{title}</h3>
      <p className="max-w-sm text-sm text-steel">{description}</p>
      {action}
    </div>
  );
}
