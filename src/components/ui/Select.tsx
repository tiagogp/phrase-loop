"use client";

import * as RadixSelect from "@radix-ui/react-select";
import type { AriaAttributes } from "react";
import { useFieldControl } from "./Field";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends AriaAttributes {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
}

export default function Select({ value, onChange, options, disabled, placeholder, ...props }: SelectProps) {
  const field = useFieldControl();
  const selected = options.find(option => option.value === value);
  // Radix reserves an empty string for its placeholder. Encode every option so
  // real choices such as "None" can round-trip an empty value without collisions.
  const optionValue = (value: string) => `option:${value}`;
  return (
    <RadixSelect.Root value={selected ? optionValue(value) : ""} onValueChange={next => onChange(next.slice(7))} disabled={disabled}>
      <RadixSelect.Trigger
        {...field}
        {...props}
        className="field-control group flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-line bg-input px-3 py-2.5 text-left text-base leading-snug text-ink outline-none transition-colors hover:border-line-strong focus-visible:border-accent aria-[invalid=true]:border-danger data-[state=open]:border-accent data-[state=open]:ring-2 data-[state=open]:ring-accent/15 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-placeholder:text-ink-muted sm:text-sm"
      >
        <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
          <RadixSelect.Value placeholder={placeholder}>{selected?.label}</RadixSelect.Value>
        </span>
        <RadixSelect.Icon className="shrink-0 text-ink-muted group-data-[state=open]:text-accent" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 12 12"
            fill="none"
            className="group-data-[state=open]:rotate-180"
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[110] max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) max-w-(--radix-select-content-available-width) overflow-hidden rounded-xl border border-line bg-card text-base shadow-[0_12px_36px_rgba(0,0,0,0.16)] sm:text-sm"
        >
          <RadixSelect.ScrollUpButton className="flex h-7 items-center justify-center bg-card text-ink-muted">
            <ScrollChevron up />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="max-h-80 scroll-py-1.5 overscroll-contain p-1.5">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={optionValue(opt.value)}
                textValue={opt.label}
                disabled={opt.disabled}
                className="field-control relative flex min-h-11 cursor-pointer select-none items-center rounded-md py-2.5 pr-9 pl-3 leading-snug text-ink outline-none data-[state=checked]:bg-accent/5 data-[state=checked]:font-medium data-[state=checked]:text-accent data-highlighted:bg-accent/10 data-disabled:pointer-events-none data-disabled:opacity-45"
              >
                <RadixSelect.ItemText className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-3 flex items-center" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="text-accent">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex h-7 items-center justify-center bg-card text-ink-muted">
            <ScrollChevron />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function ScrollChevron({ up = false }: { up?: boolean }) {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 12 12" fill="none" className={up ? "rotate-180" : undefined}>
    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
