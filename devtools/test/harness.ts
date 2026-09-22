import { act } from "preact/test-utils";
import { fireEvent, within } from "@testing-library/dom";
import { mountRoutierDevtools, type InspectableStore, type MountOptions, type UnmountDevtools } from "@routier/devtools";

export interface MountedDevtools {
  host: HTMLElement;
  shadow: ShadowRoot;
  ui: ReturnType<typeof within>;
  unmount: UnmountDevtools;
  toggle: () => void;
  select: (name: RegExp | string) => void;
}

function findHost(): HTMLElement {
  const host = document.querySelector<HTMLElement>("[data-routier-devtools]");
  if (host === null) throw new Error("devtools host was not mounted");
  return host;
}

function findContainer(shadow: ShadowRoot): HTMLElement {
  const container = shadow.querySelector<HTMLElement>(".routier-devtools");
  if (container === null) throw new Error("devtools container was not rendered");
  return container;
}

export function mount(store: InspectableStore, options?: MountOptions): MountedDevtools {
  let unmount: UnmountDevtools = () => undefined;
  act(() => {
    unmount = mountRoutierDevtools(store, options);
  });
  const host = findHost();
  const shadow = host.shadowRoot;
  if (shadow === null) throw new Error("devtools host has no shadow root");
  const ui = within(findContainer(shadow));

  return {
    host,
    shadow,
    ui,
    unmount: () => act(() => unmount()),
    toggle: () => act(() => {
      fireEvent.click(ui.getByRole("button", { name: /routier devtools/i }));
    }),
    select: (name) => act(() => {
      fireEvent.click(ui.getByRole("button", { name }));
    }),
  };
}

export function interact(action: () => void): void {
  act(action);
}
