"use client";

import * as RadixSelect from "@radix-ui/react-select";
import type { AriaAttributes } from "react";
import { useFieldControl } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends AriaAttributes {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export default function Select({ value, onChange, options, disabled, ...props }: SelectProps) {
  const field = useFieldControl();
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        {...field}
        {...props}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-line bg-input px-3 py-2 text-left text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 aria-[invalid=true]:border-danger data-disabled:cursor-not-allowed data-disabled:opacity-50 [&>span:first-child]:truncate"
      >
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0 text-ink-muted"
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-[110] max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-line bg-card text-sm shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <RadixSelect.Viewport className="p-1 max-h-64 overflow-y-auto">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="flex min-h-11 cursor-pointer select-none items-center gap-2 rounded px-3 py-2 text-ink outline-none transition-colors data-highlighted:bg-accent/10"
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
