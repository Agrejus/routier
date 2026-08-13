import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { RelayStore, seedStore } from './store';
import { BackendKind, createBrowserStore } from './browserStore';

const StoreContext = createContext<{
  store: RelayStore;
  backend: BackendKind;
  setBackend: (kind: BackendKind) => void;
  ready: boolean;
  error: string | null;
  reset: () => Promise<void>;
} | null>(null);

const valid = new Set<BackendKind>(['memory', 'localStorage', 'dexie', 'pouchdb', 'remote']);
const initialBackend = (): BackendKind => {
  const saved = localStorage.getItem('relayops-backend') as BackendKind | null;
  return saved && valid.has(saved) ? saved : 'dexie';
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [backend, setBackendState] = useState<BackendKind>(initialBackend);
  const [generation, setGeneration] = useState(0);
  const store = useMemo(() => createBrowserStore(backend), [backend, generation]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    seedStore(store)
      .then(() => { if (active) setReady(true); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)); });
    return () => {
      active = false;
      store[Symbol.dispose]();
    };
  }, [store]);

  const setBackend = (kind: BackendKind) => {
    localStorage.setItem('relayops-backend', kind);
    setBackendState(kind);
  };

  const reset = async () => {
    await store.destroyAsync();
    setGeneration(x => x + 1);
  };

  return <StoreContext.Provider value={{ store, backend, setBackend, ready, error, reset }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used under StoreProvider');
  return value;
}
