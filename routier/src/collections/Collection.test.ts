import { describe, it, expect, vi } from 'vitest';
import { Collection } from './Collection';

const createMockDeps = () => {
    const changeTracker = {
        add: vi.fn(),
        hasChanges: vi.fn(),
        clearAdditions: vi.fn(),
        prepareAdditions: vi.fn(),
        prepareRemovals: vi.fn(),
        getAttachmentsChanges: vi.fn(),
        getAndDestroyTags: vi.fn(),
        remove: vi.fn(),
        removeByQuery: vi.fn(),
        resolve: vi.fn(),
        isAttached: vi.fn(),
        filterAttached: vi.fn(),
        getAttached: vi.fn(),
        markDirty: vi.fn(),
        replace: vi.fn(),
        enrich: vi.fn(),
        mergeChanges: vi.fn(),
        instance: vi.fn(),
        detach: vi.fn()
    };
    const dataBridge = {};
    const schema = {
        createSubscription: vi.fn(() => ({ send: vi.fn() }))
    };
    const parent = {};
    return { changeTracker, dataBridge, schema, parent };
};

describe('Collection', () => {
    it('calls changeTracker.add with correct arguments and invokes callback', () => {
        const { changeTracker, dataBridge, schema, parent } = createMockDeps();
        const pipelines = { save: { pipe: vi.fn().mockReturnThis() }, hasChanges: { pipe: vi.fn().mockReturnThis() } };
        const options = { signal: undefined };
        const collection = new Collection(
            {} as any,
            schema as any,
            options as any,
            pipelines as any,
            parent as any
        );
        // @ts-expect-error override for test
        collection.changeTracker = changeTracker;
        const entities = [{ name: 'test' }];
        const done = vi.fn();
        collection.add(entities, done);
        expect(changeTracker.add).toHaveBeenCalledWith(entities, null, done);
    });
}); 