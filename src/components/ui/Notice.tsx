import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const toneClass = {
  default: "border-line",
  success: "border-success",
  error: "border-danger",
  warning: "border-warning",
} as const;

export interface NoticeProps extends ComponentProps<"div"> {
  tone?: keyof typeof toneClass;
}

export function Notice({ className, tone = "default", ...props }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : tone === "success" ? "status" : undefined}
      className={cn("min-w-0 rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed text-ink-soft wrap-anywhere", toneClass[tone], className)}
      {...props}
    />
  );
}
