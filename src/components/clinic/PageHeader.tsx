import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 mb-6">
      <div>
        {eyebrow && (
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-4xl md:text-5xl text-foreground leading-[1.05]">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`clinic-card p-3.5 ${className}`}>{children}</div>;
}

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${className}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const i = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="rounded-full bg-muted text-foreground/70 flex items-center justify-center text-xs font-medium border border-border"
      style={{ width: size, height: size }}
    >
      {i}
    </div>
  );
}
