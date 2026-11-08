import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { registerGeneratedFunctions, s } from '@routier/core/schema';
import type { FunctionRecorder, GeneratedFunctions } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const NativeFunction = globalThis.Function;

const newRecorder = (): FunctionRecorder => ({ functions: new Map(), collections: new Set() });

const recordWhile = async (build: () => Promise<void>): Promise<FunctionRecorder> => {
    const recorder = newRecorder();

    globalThis.__routierFunctionRecorder = recorder;

    try {
        await build();
    } finally {
        globalThis.__routierFunctionRecorder = undefined;
    }

    return recorder;
};

const loadFreshModule = () => jest.isolateModulesAsync(async () => {
    await import('../collection-builder/fullTextSearch');
});

const toTable = (recorder: FunctionRecorder): GeneratedFunctions =>
    Object.fromEntries([...recorder.functions.values()].map(({ key, parameters, body }) => [key, NativeFunction(...parameters, `"use strict";\n${body}`)]));

const blockEval = () => {
    const block = () => {
        throw new EvalError('eval is blocked');
    };

    globalThis.Function = new Proxy(NativeFunction, { apply: block, construct: block });
};

const stringKeyed = () => s.define('generated_notes', { id: s.string().key(), text: s.string().searchable() });
const numberKeyed = () => s.define('generated_counts', { id: s.number().key(), text: s.string().searchable() });

afterEach(() => {
    globalThis.Function = NativeFunction;
});

describe('the search index schema while recording', () => {
    it('is recorded when the module loads', async () => {
        const recorder = await recordWhile(loadFreshModule);

        expect([...recorder.collections]).toContain('full-text-search-index');
    });

    it('is not compiled when the module loads outside a recording', async () => {
        blockEval();

        await expect(loadFreshModule()).resolves.toBeUndefined();
    });
});

const useOnlyRecordedFunctions = async (compileApp: () => void) => {
    const recorder = await recordWhile(async () => {
        await loadFreshModule();
        compileApp();
    });

    registerGeneratedFunctions(toTable(recorder));
    blockEval();
};

describe('a store with full-text search, eval blocked', () => {
    it('searches a collection with a string key', async () => {
        await useOnlyRecordedFunctions(() => stringKeyed().compile());

        const schema = stringKeyed().compile();

        class Store extends DataStore {
            notes = this.collection(schema).fullTextSearch().proxy().create();
        }

        const store = new Store(new MemoryPlugin('generated-search-string'));

        await store.notes.addAsync({ id: 'a', text: 'hello world' });
        await store.saveChangesAsync();

        const found = await store.notes.search('hello').toArrayAsync();

        expect(found.map(row => row.id)).toEqual(['a']);
    });

    it('searches a collection with a number key', async () => {
        await useOnlyRecordedFunctions(() => numberKeyed().compile());

        const schema = numberKeyed().compile();

        class Store extends DataStore {
            counts = this.collection(schema).fullTextSearch().proxy().create();
        }

        const store = new Store(new MemoryPlugin('generated-search-number'));

        await store.counts.addAsync({ id: 1, text: 'hello world' });
        await store.saveChangesAsync();

        const found = await store.counts.search('hello').toArrayAsync();

        expect(found.map(row => row.id)).toEqual([1]);
    });
});
