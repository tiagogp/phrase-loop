import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspace } from "./createWorkspace";

let root: ReturnType<typeof createRoot>;
let host: HTMLElement;
beforeEach(() => {
  const { window, document } = parseHTML("<html><body><div id='root'></div></body></html>");
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.getElementById("root")!;
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

describe("preloaded workspace", () => {
  it("renders a warmed screen immediately without mounting its loading fallback", async () => {
    const Loading = vi.fn(() => <p>Loading</p>);
    const workspace = createWorkspace(async () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }), Loading);
    await workspace.preload();
    await act(async () => root.render(<workspace.Screen title="Library" />));
    expect(host.textContent).toBe("Library");
    expect(Loading).not.toHaveBeenCalled();
  });

  it("keeps a screen's state when a background preload completes after opening", async () => {
    function Draft() {
      const [text, setText] = useState("draft");
      return <button onClick={() => setText("edited")}>{text}</button>;
    }
    const workspace = createWorkspace(async () => ({ default: Draft }), () => <p>Loading</p>);
    await act(async () => root.render(<workspace.Screen />));
    await act(async () => host.querySelector("button")!.click());
    await workspace.preload();
    await act(async () => root.render(<workspace.Screen />));
    expect(host.textContent).toBe("edited");
  });

  it("shows the fallback for an unfinished import and renders when it resolves", async () => {
    let finish!: (value: { default: React.ComponentType }) => void;
    const workspace = createWorkspace(() => new Promise<{ default: React.ComponentType }>(resolve => { finish = resolve; }), () => <p>Loading</p>);
    await act(async () => root.render(<workspace.Screen />));
    expect(host.textContent).toBe("Loading");
    await act(async () => finish({ default: () => <h1>Ready</h1> }));
    expect(host.textContent).toBe("Ready");
  });
});
