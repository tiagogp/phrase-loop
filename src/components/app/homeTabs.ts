/** Stable destinations: core features never disappear behind a level or activity gate. */
export const HOME_TABS = [
  { id: "hoje", label: "Today" },
  { id: "study", label: "My library" },
  { id: "explore", label: "Explore" },
  { id: "conversa", label: "Talk" },
  { id: "discover", label: "Content" },
  { id: "progress", label: "Progress" },
] as const;

// Legacy destinations remain valid for plan tasks and the landing preview.
export type HomeTab = (typeof HOME_TABS)[number]["id"] | "speak" | "correct";
