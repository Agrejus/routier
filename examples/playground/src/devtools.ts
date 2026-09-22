import { mountRoutierDevtools, type InspectableStore, type UnmountDevtools } from "@routier/devtools/production";

const mounted = new Map<string, UnmountDevtools>();

export function showInDevtools(store: InspectableStore, name: string): UnmountDevtools {
  mounted.get(name)?.();
  const unmount = mountRoutierDevtools(store, { name });
  mounted.set(name, unmount);
  return () => {
    if (mounted.get(name) !== unmount) return;
    mounted.delete(name);
    unmount();
  };
}
