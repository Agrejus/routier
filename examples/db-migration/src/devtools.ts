import type { DataStore } from '@routier/datastore';
import { mountRoutierDevtools } from '@routier/devtools/production';

export function showInDevtools(store: DataStore, name: string): void {
    const unmount = mountRoutierDevtools(store, { name });
    store.inspect().disposed.addEventListener('abort', unmount, { once: true });
}
