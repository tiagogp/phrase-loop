"use client";

import { createContext } from "react";

/** Retained tab trees keep their state, but must not count background activity. */
export const WorkspaceActivityContext = createContext(true);
