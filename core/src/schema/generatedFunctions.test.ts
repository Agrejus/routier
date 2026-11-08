import { afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { isRecordingFunctions, registerGeneratedFunctions, s } from './index';
import { createFunctionSource } from './generatedFunctions';
import type { EmittedFunction, FunctionRecorder, GeneratedFunctions } from './generatedFunctions';

const NativeFunction = globalThis.Function;

const toTable = (emitted: readonly EmittedFunction[]): GeneratedFunctions =>
    Object.fromEntries(emitted.map(({ key, parameters, body }) => [key, NativeFunction(...parameters, `"use strict";\n${body}`)]));

const record = (build: () => void): FunctionRecorder => {
    const recorder: FunctionRecorder = { functions: new Map(), collections: new Set() };

    globalThis.__routierFunctionRecorder = recorder;

    try {
        build();
    } finally {
        globalThis.__routierFunctionRecorder = undefined;
    }

    return recorder;
};

const recordedFunctions = (build: () => void): EmittedFunction[] => [...record(build).functions.values()];

const define = () => s.define('things', {
    id: s.string().key().identity(),
    name: s.string(),
    nested: s.object({ a: s.string() }),
    tags: s.string().array(),
    label: s.string().default(() => 'from-closure'),
}).modify(x => ({
    upper: x.computed(entity => entity.name.toUpperCase()),
}));

type Schema = ReturnType<ReturnType<typeof define>['compile']>;
type Thing = ReturnType<Schema['clone']>;

const thing = (): Thing => ({ id: 'a', name: 'x', nested: { a: 'one' }, tags: ['t'], label: 'l', upper: 'X' });

const blockEval = () => {
    const block = () => {
        throw new EvalError('eval is blocked');
    };

    globalThis.Function = new Proxy(NativeFunction, { apply: block, construct: block });
};

const recordEvals = () => {
    const bodies: string[] = [];

    globalThis.Function = new Proxy(NativeFunction, {
        apply(target, thisArg, args: string[]) {
            bodies.push(args[args.length - 1]);
            return Reflect.apply(target, thisArg, args);
        },
    });

    return bodies;
};

const runEverything = (schema: Schema): string => JSON.stringify({
    enrich: schema.enrich(thing(), 'diff'),
    postprocess: schema.postprocess(thing(), 'diff'),
    prepare: schema.prepare(thing()),
    preprocess: schema.preprocess(thing()),
    clone: schema.clone(thing()),
    cloneStorage: schema.cloneStorage(thing()),
    serialize: schema.serialize(thing()),
    deserialize: schema.deserialize(thing()),
    strip: schema.strip(thing()),
    hash: schema.hash(thing(), schema.getHashType(thing())),
    ids: schema.getIds(thing()),
    id: schema.getId(thing()),
    compare: schema.compare(thing(), thing()),
    compareIds: schema.compareIds(thing(), { ...thing(), id: 'b' }),
    merge: schema.merge(thing(), { ...thing(), name: 'merged' }),
    schemaId: schema.id,
});

let expectedWithEval: string;

beforeAll(() => {
    expectedWithEval = runEverything(define().compile());
    registerGeneratedFunctions(toTable(recordedFunctions(() => define().compile())));
});

afterEach(() => {
    globalThis.Function = NativeFunction;
});

describe('recording', () => {
    it('records the same functions for the same schema', () => {
        const first = recordedFunctions(() => define().compile());
        const second = recordedFunctions(() => define().compile());

        expect(first).toEqual(second);
    });

    it('gives each function its own key', () => {
        const emitted = recordedFunctions(() => define().compile());

        expect(new Set(emitted.map(item => item.key)).size).toBe(emitted.length);
    });

    it('names every schema it records', () => {
        const recorder = record(() => {
            s.define('users', { id: s.string().key() }).compile();
            s.define('orders', { id: s.number().key() }).compile();
        });

        expect([...recorder.collections]).toEqual(['users', 'orders']);
    });

    it('records nothing for a schema that is defined but not compiled', () => {
        const recorder = record(() => {
            define();
        });

        expect(recorder.functions.size).toBe(0);
        expect(recorder.collections.size).toBe(0);
    });

    it('still returns a working schema', () => {
        let schema: Schema | undefined;

        record(() => {
            schema = define().compile();
        });

        expect(schema == null ? '' : runEverything(schema)).toBe(expectedWithEval);
    });

    it('includes the storage clone, which compile otherwise builds on first use', () => {
        const definition = () => s.define('recordedClone', { id: s.string().key(), recordedClone: s.string() });

        registerGeneratedFunctions(toTable(recordedFunctions(() => definition().compile())));
        blockEval();

        const entity = { id: 'a', recordedClone: 'b' };

        expect(definition().compile().cloneStorage(entity)).toEqual(entity);
    });

    it('stops once the recorder is gone', () => {
        const recorder = record(() => undefined);

        define().compile();

        expect(recorder.functions.size).toBe(0);
    });

    it('throws for a schema that does not compile', () => {
        expect(() => record(() => {
            s.define('keyless', { name: s.string() }).compile();
        })).toThrow('Schema must have a key');
    });

    it('keeps parameter lists apart when they join to the same text', () => {
        const recorder = record(() => {
            const source = createFunctionSource('things');

            source.compile(['a', 'b'], 'return 1;');
            source.compile(['ab'], 'return 1;');
        });

        expect(recorder.functions.size).toBe(2);
    });

    it('says when it is recording', () => {
        let during = false;

        record(() => {
            during = isRecordingFunctions();
        });

        expect(during).toBe(true);
        expect(isRecordingFunctions()).toBe(false);
    });

    it('runs what it records, without generated functions', () => {
        record(() => {
            expect(createFunctionSource('things').compile(['a'], 'return a + 1;')(1)).toBe(2);
        });
    });
});

describe('compile with generated functions', () => {
    it('runs every function with eval blocked', () => {
        blockEval();

        expect(runEverything(define().compile())).toBe(expectedWithEval);
    });

    it('takes defaults and computeds from the schema file at run time', () => {
        blockEval();

        const enriched = define().compile().enrich({ name: 'x', nested: { a: 'one' }, tags: [] }, 'diff');

        expect(enriched).toMatchObject({ label: 'from-closure', upper: 'X' });
    });

    it('finds functions registered after the schema was defined', () => {
        const definition = () => s.define('late', { id: s.string().key(), late: s.string() });
        const table = toTable(recordedFunctions(() => definition().compile()));
        const defined = definition();

        registerGeneratedFunctions(table);
        blockEval();

        expect(defined.compile().clone({ id: 'a', late: 'b' })).toEqual({ id: 'a', late: 'b' });
    });

    it('adds to the functions already registered', () => {
        const definition = () => s.define('second', { id: s.string().key(), second: s.string() });

        registerGeneratedFunctions(toTable(recordedFunctions(() => definition().compile())));
        blockEval();

        expect(() => definition().compile()).not.toThrow();
        expect(() => define().compile()).not.toThrow();
    });

    it('looks up the storage clone only on first use', () => {
        const definition = () => s.define('lazyClone', { id: s.string().key(), lazyClone: s.string() });
        const emitted = recordedFunctions(() => definition().compile());
        const bodies = recordEvals();

        definition().compile();
        globalThis.Function = NativeFunction;

        registerGeneratedFunctions(toTable(emitted.filter(item => bodies.includes(`"use strict";\n${item.body}`))));
        blockEval();

        const schema = definition().compile();

        expect(() => schema.cloneStorage({ id: 'a', lazyClone: 'b' })).toThrow('npx @routier/cli generate');
    });
});

describe('two copies of core', () => {
    it('share the functions one copy registers', async () => {
        const definition = () => s.define('copies', { id: s.string().key(), copies: s.string() });
        const table = toTable(recordedFunctions(() => definition().compile()));

        await jest.isolateModulesAsync(async () => {
            const otherCopy = await import('./generatedFunctions');

            otherCopy.registerGeneratedFunctions(table);
        });
        blockEval();

        expect(definition().compile().clone({ id: 'a', copies: 'b' })).toEqual({ id: 'a', copies: 'b' });
    });

    it('find the functions registered before the copy loaded', async () => {
        const emitted = recordedFunctions(() => s.define('earlier', { id: s.string().key(), earlier: s.string() }).compile());
        const [first] = emitted;

        registerGeneratedFunctions(toTable(emitted));

        await jest.isolateModulesAsync(async () => {
            const otherCopy = await import('./generatedFunctions');

            blockEval();

            expect(otherCopy.createFunctionSource('earlier').compile(first.parameters, first.body)).toEqual(expect.any(Function));
        });
    });
});

describe('compile without generated functions', () => {
    it('uses eval when it is allowed', () => {
        const schema = s.define('unregistered', { id: s.string().key(), onlyEval: s.string() }).compile();

        expect(schema.clone({ id: 'a', onlyEval: 'b' })).toEqual({ id: 'a', onlyEval: 'b' });
    });

    it('names the schema and the fix when eval is blocked', () => {
        blockEval();

        expect(() => s.define('unregistered', { id: s.string().key(), blocked: s.string() }).compile())
            .toThrow(`The schema 'unregistered' has no generated function. Run "npx @routier/cli generate", and import the generated file before your schemas.`);
    });

    it('treats a changed schema as missing', () => {
        blockEval();

        expect(() => s.define('things', { id: s.string().key().identity(), renamed: s.string() }).compile())
            .toThrow('npx @routier/cli generate');
    });

    it('keeps other errors as they are', () => {
        expect(() => createFunctionSource('things').compile([], 'return (')).toThrow(SyntaxError);
    });
});

describe('strict mode', () => {
    it('freezes an entity twice without throwing', () => {
        const schema = define().compile();
        const entity = thing();

        schema.freeze(schema.freeze(entity));

        expect(Object.isFrozen(entity)).toBe(true);
        expect(Object.isFrozen(entity.nested)).toBe(true);
        expect(Object.isFrozen(entity.tags)).toBe(true);
    });
});
