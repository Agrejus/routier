import { describe, it, expect, vi } from 'vitest';
import { DataStore } from './DataStore';

describe('DataStore', () => {
    it('calls saveChanges pipeline with correct arguments and invokes callback', () => {
        const dbPlugin = {};
        const mockPipeline = { filter: vi.fn() };
        const store = new DataStore(dbPlugin as any);
        // @ts-expect-error override for test
        store.collectionPipelines.preparePreviewChanges = mockPipeline;
        const done = vi.fn();
        store.saveChanges(done);
        expect(mockPipeline.filter).toHaveBeenCalledWith(
            expect.objectContaining({ count: 0 }),
            expect.any(Function)
        );
    });

    it('calls hasChanges pipeline with correct arguments and invokes callback', () => {
        const dbPlugin = {};
        const mockPipeline = { filter: vi.fn() };
        const store = new DataStore(dbPlugin as any);
        // @ts-expect-error override for test
        store.collectionPipelines.hasChanges = mockPipeline;
        const done = vi.fn();
        store.hasChanges(done);
        expect(mockPipeline.filter).toHaveBeenCalledWith(
            { hasChanges: false },
            expect.any(Function)
        );
    });

    it('delegates destroy to the database plugin with correct callback', () => {
        const dbPlugin = { destroy: vi.fn() };
        const store = new DataStore(dbPlugin as any);
        const done = vi.fn();
        store.destroy(done);
        expect(dbPlugin.destroy).toHaveBeenCalledWith(done);
    });

    it('aborts controller when disposed', () => {
        const dbPlugin = {};
        const store = new DataStore(dbPlugin as any);
        const abortSpy = vi.spyOn(store['abortController'], 'abort');
        store[Symbol.dispose]();
        expect(abortSpy).toHaveBeenCalledWith('Routier disposed');
    });
}); 