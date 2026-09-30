"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { springSoft, tweenSmooth } from "@/lib/motion";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
  closeOnBackdrop?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    panel.focus();

    // Hide the background from keyboard and assistive technology without hiding
    // Select portals, which mount directly under body after the dialog opens.
    const background: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = panel;
    while (branch.parentElement && branch.parentElement !== document.body) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => element.getClientRects().length > 0 && !element.closest('[inert], [hidden], [aria-hidden="true"]'));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = previousOverflow;
      const previous = previouslyFocusedRef.current;
      if (previous?.isConnected) previous.focus();
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    // A wizard step can remove the focused control while the dialog stays open.
    if (open && document.activeElement === document.body) {
      panelRef.current?.focus();
    }
  });

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4 backdrop-blur-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={tweenSmooth}
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
          }}
        >
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.97, y: 8, filter: "blur(8px)" }}
            transition={springSoft}
            className={cn(
              // The panel scrolls itself: a centred grid item taller than the viewport would
              // otherwise overflow a fixed overlay that has nowhere to scroll, silently cutting
              // off the end of long dialogs (the placement check's later items and its buttons).
              "max-h-[calc(100dvh-2rem)] w-[min(100%,30rem)] overflow-y-auto overscroll-contain rounded-xl border border-line bg-card p-4 sm:p-6 shadow-[0_20px_60px_rgb(0_0_0/0.25)] outline-none",
              className,
            )}
          >
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
