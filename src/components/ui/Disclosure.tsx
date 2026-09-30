"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Disclosure.module.css";

export interface DisclosureProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  contentClassName?: string;
  nested?: boolean;
}

export default function Disclosure({
  title,
  description,
  badge,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = "",
  contentClassName,
  nested = false,
}: DisclosureProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const contentId = useId();

  return (
    <section
      className={cn(
        styles.root,
        "rounded-panel border bg-card",
        nested && styles.nested,
        className,
      )}
      data-open={open}
    >
      <button
        type="button"
        className={cn(styles.trigger, "flex min-h-14 w-full cursor-pointer items-center gap-4 px-4 py-3 text-left text-ink")}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => {
          if (controlledOpen === undefined) setInternalOpen(!open);
          onOpenChange?.(!open);
        }}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold tracking-[-0.01em]">{title}</span>
          {description && <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{description}</span>}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {badge}
          <span className={styles.indicator} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.chevron}>
              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </button>
      {/* Keep form state while collapsed, but remove hidden controls from navigation. */}
      <div id={contentId} className={styles.reveal} aria-hidden={!open} inert={!open}>
        <div className={styles.clip}>
          <div className={cn("mx-4 border-t border-line/70 pb-4 pt-4", contentClassName)}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
