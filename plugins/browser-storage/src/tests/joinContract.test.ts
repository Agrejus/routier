import { describeJoinContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { BrowserStoragePlugin } from '../BrowserStoragePlugin';

/**
 * A Map-backed `Storage`, for the same reason `browserStorage.test.ts` uses one: the plugin
 * takes a `Storage` rather than reaching for a global, so the suite needs no DOM.
 */
class MapStorage implements Storage {
    private readonly entries = new Map<string, string>();

    get length() { return this.entries.size; }
    clear() { this.entries.clear(); }
    getItem(key: string) { return this.entries.get(key) ?? null; }
    key(index: number) { return [...this.entries.keys()][index] ?? null; }
    removeItem(key: string) { this.entries.delete(key); }
    setItem(key: string, value: string) { this.entries.set(key, String(value)); }
}

describeJoinContract('browser-storage', () => new BrowserStoragePlugin(`join-${uuidv4()}`, new MapStorage()));
