interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-signal-yellow-600">{eyebrow}</p>
      <h1 className="mt-1 text-3xl text-asphalt sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-steel">{subtitle}</p>}
    </header>
  );
}
