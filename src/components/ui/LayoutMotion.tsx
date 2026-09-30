"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadFeatures = () => import("@/lib/layoutMotionFeatures").then(module => module.default);

/** Load layout projection only for the lists that actually animate reordering. */
export function LayoutMotion({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
