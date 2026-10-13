import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
}

/** Consistent page identity for primary tabs and full-screen app overlays. */
export function PageHeader({ eyebrow, title, description, aside, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.8px] text-accent">{eyebrow}</p>
        )}
        <h1 className={cn("text-2xl font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-3xl", eyebrow && "mt-2")}>
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {aside && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[45%]">{aside}</div>}
    </header>
  );
}
