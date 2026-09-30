"use client";

import { useSyncExternalStore } from "react";
import { tutorMemoryResource as resource } from "./tutorMemoryResource";

export function useTutorMemory() {
  const { data: memory, error } = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
  return { memory, error, refresh: resource.refresh };
}
