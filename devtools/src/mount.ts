import { attempt } from "./errors/attempt";
import {
  registerPage,
  registerStore,
  type InspectableStore,
  type MountOptions,
  type UnmountDevtools,
} from "./host/devtoolsHost";

export type { InspectableStore, MountOptions, UnmountDevtools } from "./host/devtoolsHost";

const unmountNothing: UnmountDevtools = () => undefined;

export function mountRoutierDevtools(store?: InspectableStore, options: MountOptions = {}): UnmountDevtools {
  if (typeof document === "undefined") return unmountNothing;
  return attempt(() => (store === undefined ? registerPage() : registerStore(store, options)), "mount", () => unmountNothing);
}
