"use client";

import { createContext, forwardRef, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "min-h-11 w-full min-w-0 rounded-md border border-line bg-input px-3 py-2 text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-55";

const FieldContext = createContext<{ id: string; describedBy?: string; invalid?: boolean } | null>(null);

/** Shared by text controls and the portalled Select trigger. */
export function useFieldControl() {
  const field = useContext(FieldContext);
  return field ? { id: field.id, "aria-describedby": field.describedBy, "aria-invalid": field.invalid || undefined } : {};
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const field = useFieldControl();
    return <input ref={ref} className={cn(control, className)} {...field} {...props} />;
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    const field = useFieldControl();
    return <textarea ref={ref} className={cn(control, "resize-y", className)} {...field} {...props} />;
  },
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-ink-muted", className)} {...props} />;
}

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Use for a set of controls or a read-only value instead of one input. */
  group?: boolean;
}

export function Field({ label, htmlFor, hint, error, className, children, group = false }: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const descriptionId = error || hint ? `${id}-description` : undefined;
  return (
    <div className={cn("min-w-0", className)} role={group ? "group" : undefined} aria-labelledby={group && label ? `${id}-label` : undefined} aria-describedby={group ? descriptionId : undefined}>
      {label && (group
        ? <p id={`${id}-label`} className="mb-1.5 text-xs font-medium text-ink-muted">{label}</p>
        : <Label htmlFor={id}>{label}</Label>)}
      <FieldContext.Provider value={group ? null : { id, describedBy: descriptionId, invalid: Boolean(error) }}>{children}</FieldContext.Provider>
      {hint && !error && <p id={descriptionId} className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p id={descriptionId} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
