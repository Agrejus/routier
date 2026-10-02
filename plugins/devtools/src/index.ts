import { mountRoutierDevtools as mountDevtools, type UnmountDevtools } from "./mount";

export type { InspectableStore, MountOptions, UnmountDevtools } from "./mount";

const mountNothing = (): UnmountDevtools => () => undefined;

export const mountRoutierDevtools: typeof mountDevtools =
  process.env.NODE_ENV === "production" ? mountNothing : mountDevtools;
