import { render } from "preact";
import type { StoreInspection } from "@routier/datastore";
import { attempt } from "../errors/attempt";
import { createFrameScheduler, type FrameScheduler } from "../live/frameScheduler";
import { devtoolsStyles } from "../styles";
import { Devtools } from "../ui/Devtools";
import { uniqueLabel, type StoreEntry } from "./storeEntry";

export interface InspectableStore {
  inspect(): StoreInspection;
}

export interface MountOptions {
  readonly name?: string;
}

export type UnmountDevtools = () => void;

interface Host {
  readonly element: HTMLElement;
  readonly container: HTMLElement;
  readonly scheduler: FrameScheduler;
}

interface Registration {
  readonly entry: StoreEntry;
  readonly unmount: UnmountDevtools;
}

const registrations = new Map<InspectableStore, Registration>();
let host: Host | null = null;
let pageUnmount: UnmountDevtools | null = null;

function createHost(): Host {
  const element = document.createElement("div");
  element.toggleAttribute("data-routier-devtools", true);
  const shadow = element.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = devtoolsStyles;
  const container = document.createElement("div");
  container.className = "routier-devtools";
  shadow.append(style, container);
  document.body.append(element);
  return { element, container, scheduler: createFrameScheduler() };
}

function renderHost(current: Host): void {
  const stores = [...registrations.values()].map((registration) => registration.entry);
  render(<Devtools stores={stores} scheduler={current.scheduler} />, current.container);
}

function removeHost(current: Host): void {
  host = null;
  current.scheduler.cancel();
  current.element.remove();
  render(null, current.container);
}

function release(current: Host): void {
  if (registrations.size === 0 && pageUnmount === null) removeHost(current);
  else renderHost(current);
}

function unregister(store: InspectableStore, current: Host): void {
  if (registrations.delete(store)) release(current);
}

function ensureHost(): Host {
  host ??= createHost();
  return host;
}

function labelFor(store: InspectableStore, options: MountOptions): string {
  const taken = [...registrations.values()].map((registration) => registration.entry.label);
  return uniqueLabel(options.name ?? store.constructor.name, taken);
}

export function registerStore(store: InspectableStore, options: MountOptions): UnmountDevtools {
  const existing = registrations.get(store);
  if (existing !== undefined) return existing.unmount;

  const entry: StoreEntry = { label: labelFor(store, options), inspection: store.inspect() };
  const current = ensureHost();
  const unmount = () => attempt(() => unregister(store, current), "unmount", () => undefined);
  registrations.set(store, { entry, unmount });
  renderHost(current);
  return unmount;
}

export function registerPage(): UnmountDevtools {
  if (pageUnmount !== null) return pageUnmount;
  const current = ensureHost();
  const unmount: UnmountDevtools = () => {
    if (pageUnmount !== unmount) return;
    pageUnmount = null;
    release(current);
  };
  pageUnmount = unmount;
  renderHost(current);
  return unmount;
}
