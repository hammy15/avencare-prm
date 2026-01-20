'use client';

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  gradient?: boolean;
}

export function Header({ title, description, actions, gradient = false }: HeaderProps) {
  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className={
              gradient
                ? "text-2xl font-semibold tracking-tight gradient-text"
                : "text-2xl font-semibold tracking-tight text-foreground"
            }
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions}
        </div>
      </div>
    </header>
  );
}
