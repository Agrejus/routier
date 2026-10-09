export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type Drafts = {
    load(id: string): string | null;
    save(id: string, code: string): void;
    clear(id: string): void;
};

const keyFor = (id: string): string => `routier-playground:draft:${id}`;

const attempt = <T>(work: () => T, fallback: T): T => {
    try {
        return work();
    } catch {
        return fallback;
    }
};

export const createDrafts = (storage: DraftStorage): Drafts => ({
    load: id => attempt(() => storage.getItem(keyFor(id)), null),
    save: (id, code) => attempt(() => storage.setItem(keyFor(id), code), undefined),
    clear: id => attempt(() => storage.removeItem(keyFor(id)), undefined),
});
