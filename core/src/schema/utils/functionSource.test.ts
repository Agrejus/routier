import { describe, expect, it } from '@jest/globals';
import { s } from '../builder';
import { etags } from '../etags';
import { SchemaEtag } from '../property/modifiers/SchemaEtag';
import { EtagValue, SchemaModifiers } from '../types';
import { compiledSchemaToJsonSchema, rehydrateSchemaFromJsonSchema } from './standardJsonSchema';
import { compileArrowFunction, rehydrateEtagComparator } from './functionSource';

type RoutierMeta = { isEtag?: boolean; etagSource?: string };

const readMeta = (jsonSchema: Record<string, unknown>, property: string): RoutierMeta => {
    const properties = jsonSchema.properties as Record<string, Record<string, RoutierMeta>>;
    return properties[property]?.['x-routier'] ?? {};
};

type EtagBuilder = SchemaEtag<number, SchemaModifiers> | SchemaEtag<string, SchemaModifiers>;

const roundTrip = (version: EtagBuilder) => {
    const schema = s.define('etag_round_trip', { id: s.string().key(), version }).compile();
    const exported = compiledSchemaToJsonSchema(schema, 'draft-2020-12', false);
    const rehydrated = rehydrateSchemaFromJsonSchema(exported).compile();
    return { exported, rehydrated };
};

describe('compileArrowFunction', () => {
    it.each([
        ['(a, b) => a + b', [1, 2], 3],
        ['(a, b) => { return a * b; }', [3, 4], 12],
        ['() => 7', [], 7],
        ['( a ,b ) =>\n a - b', [9, 4], 5],
        ['(a,b)=>a+b', [2, 5], 7],
        ['(a, b) => { return a * b; }\n', [2, 3], 6],
    ])('compiles %p', (source, args, expected) => {
        expect(compileArrowFunction(source)(...args)).toBe(expected);
    });

    it.each([
        ['a => a'],
        ['function (a) { return a; }'],
        [''],
        ['x (a) => a'],
    ])('rejects %p', source => {
        expect(() => compileArrowFunction(source)).toThrow('Function source is not an arrow function');
    });
});

describe('rehydrateEtagComparator', () => {
    it('compares with the rebuilt source', () => {
        const comparator = rehydrateEtagComparator('(prev, next) => prev - next', 'version');

        expect(comparator(5, 2)).toBe(3);
    });

    it('returns the original source from toString', () => {
        const source = '(prev, next) => prev - next';

        expect(rehydrateEtagComparator(source, 'version').toString()).toBe(source);
    });

    it('coerces the result to a number', () => {
        const comparator = rehydrateEtagComparator('(prev, next) => String(prev === next ? 0 : 1)', 'version');

        expect(comparator(1, 1)).toBe(0);
    });

    it.each([
        ['prev => prev', 'Function source is not an arrow function'],
        ['(prev, next) => prev +', 'Cannot recreate the etag comparator for property version'],
    ])('returns a comparator that throws for %p', (source, message) => {
        const comparator = rehydrateEtagComparator(source, 'version');

        expect(() => comparator(1, 2)).toThrow(message);
    });

    it('keeps the unparseable source for the next export', () => {
        expect(rehydrateEtagComparator('prev => prev', 'version').toString()).toBe('prev => prev');
    });
});

describe('etag JSON Schema round trip', () => {
    it('exports the etag flag and comparator source', () => {
        const { exported } = roundTrip(s.number().etag(etags.numeric));

        expect(readMeta(exported, 'version')).toEqual(expect.objectContaining({
            isEtag: true,
            etagSource: etags.numeric.toString(),
        }));
    });

    it('does not mark other properties as etags', () => {
        const { exported } = roundTrip(s.number().etag(etags.numeric));

        expect(readMeta(exported, 'id').isEtag).toBeUndefined();
    });

    it('rehydrates numeric so it compares the same pairs the same way', () => {
        const pairs: [number, number][] = [[1, 2], [2, 1], [4, 4]];
        const rebuilt = roundTrip(s.number().etag(etags.numeric)).rehydrated.etagProperty?.etagComparator;

        expect(pairs.map(([prev, next]) => rebuilt?.(prev, next))).toEqual(pairs.map(([prev, next]) => etags.numeric(prev, next)));
    });

    it('rehydrates lexical so it compares the same pairs the same way', () => {
        const pairs: [string, string][] = [['a', 'b'], ['b', 'a'], ['c', 'c']];
        const rebuilt = roundTrip(s.string().etag(etags.lexical)).rehydrated.etagProperty?.etagComparator;

        expect(pairs.map(([prev, next]) => rebuilt?.(prev, next))).toEqual(pairs.map(([prev, next]) => etags.lexical(prev, next)));
    });

    it('rehydrates the etag as the schema etag property', () => {
        const { rehydrated } = roundTrip(s.number().etag(etags.numeric));

        expect(rehydrated.etagProperty?.name).toBe('version');
        expect(rehydrated.etagProperty?.isOptional).toBe(false);
    });

    it('keeps an optional etag optional', () => {
        const { rehydrated } = roundTrip(s.number().etag(etags.numeric).optional());

        expect(rehydrated.etagProperty?.isOptional).toBe(true);
    });

    it('writes the same source when exported a second time', () => {
        const { exported, rehydrated } = roundTrip(s.number().etag(etags.numeric));
        const again = compiledSchemaToJsonSchema(rehydrated, 'draft-2020-12', false);

        expect(readMeta(again, 'version').etagSource).toBe(readMeta(exported, 'version').etagSource);
    });

    it('rehydrates a property without Routier metadata as a plain property', () => {
        const rehydrated = rehydrateSchemaFromJsonSchema({
            type: 'object',
            properties: { id: { type: 'string', 'x-routier': { isKey: true } }, version: { type: 'number' } },
            required: ['id', 'version'],
        }).compile();

        expect(rehydrated.etagProperty).toBeNull();
    });

    it('rehydrates a custom self-contained comparator', () => {
        const byGeneration = (prev: EtagValue, next: EtagValue) => Number(String(prev).split('-')[0]) - Number(String(next).split('-')[0]);
        const { rehydrated } = roundTrip(s.string().etag(byGeneration));

        expect(rehydrated.etagProperty?.etagComparator?.('3-a', '2-b')).toBe(1);
    });
});

describe('computed JSON Schema round trip', () => {
    it('writes the same function source when exported a second time', () => {
        const schema = s.define('computed_round_trip', {
            id: s.string().key(),
            first: s.string(),
        }).modify(x => ({ upper: x.computed((entity) => entity.first.toUpperCase()) })).compile();
        const exported = compiledSchemaToJsonSchema(schema, 'draft-2020-12', true);
        const rehydrated = rehydrateSchemaFromJsonSchema(exported).compile();
        const again = compiledSchemaToJsonSchema(rehydrated, 'draft-2020-12', true);
        const source = (json: Record<string, unknown>) =>
            (json.properties as Record<string, Record<string, { functionSource?: string }>>).upper?.['x-routier']?.functionSource;

        expect(source(again)).toBe(source(exported));
    });
});
