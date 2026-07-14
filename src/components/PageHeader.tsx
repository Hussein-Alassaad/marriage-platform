import { type ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-brand-700 mb-2 text-xs font-semibold tracking-wider uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-ink text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? <p className="text-muted mt-1.5 text-sm leading-relaxed">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
