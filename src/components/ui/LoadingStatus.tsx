"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Spinner } from "./Spinner";

export function LoadingStatus({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => {
    status.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);

  return (
    <div ref={status} className="flex flex-wrap items-center gap-3 rounded-md border border-accent/25 bg-accent/5 p-3 text-sm text-ink">
      <p role="status" aria-atomic="true" className="flex min-w-0 flex-1 items-center gap-2">
        <Spinner className="shrink-0 text-accent" />
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}
