import { describe, expect, it } from '@jest/globals';
import { s } from './builder';

const schema = s.define('campgrounds', {
    id: s.string().key(),
    top: s.object({ label: s.string() }).optional().nullable(),
    facts: s.object({
        name: s.object({
            value: s.object({ type: s.string(), at: s.date() }).optional().nullable(),
            verified: s.boolean(),
        }).optional(),
    }),
}).compile();

type Shape = { id: string; top?: { label: string } | null; facts: { name?: { value?: { type: string; at: Date } | null; verified: boolean } } };

const shapes: [string, () => Shape][] = [
    ['null objects', () => ({ id: '1', top: null, facts: { name: { value: null, verified: false } } })],
    ['absent objects', () => ({ id: '2', facts: {} })],
    ['an absent nested nullable object', () => ({ id: '3', facts: { name: { verified: true } } })],
];

const present = (): Shape => ({ id: '4', top: { label: 'x' }, facts: { name: { value: { type: 't', at: new Date(0) }, verified: true } } });

const stored = (shape: Shape) => JSON.parse(JSON.stringify(shape));

describe('nullable and optional objects', () => {
    it.each(shapes)('preprocess keeps %s as they are', (_label, make) => {
        expect(schema.preprocess(make() as never)).toEqual(stored(make()));
    });

    it.each(shapes)('serialize keeps %s as they are', (_label, make) => {
        expect(schema.serialize(make() as never)).toEqual(stored(make()));
    });

    it.each(shapes)('deserialize keeps %s as they are', (_label, make) => {
        expect(schema.deserialize(stored(make()))).toEqual(make());
    });

    it.each(shapes)('enrich keeps %s as they are', (_label, make) => {
        expect({ ...schema.enrich(stored(make()), 'immutable') }).toEqual(make());
    });

    it.each(shapes)('clone keeps %s as they are', (_label, make) => {
        expect(schema.clone(make() as never)).toEqual(make());
    });

    it.each(shapes)('strip keeps %s as they are', (_label, make) => {
        const { id: _id, ...rest } = make();
        expect(schema.strip(make() as never)).toEqual(rest);
    });

    it('keeps an empty required object when cloning', () => {
        expect(schema.clone({ id: '5', facts: {} } as never)).toEqual({ id: '5', facts: {} });
    });

    it('round trips a fully present entity unchanged', () => {
        const entity = present();
        expect(schema.deserialize(schema.preprocess(entity as never) as never)).toEqual(entity);
        expect(schema.clone(entity as never)).toEqual(entity);
    });

    it('does not share a cloned object with the source', () => {
        const entity = present();
        const clone = schema.clone(entity as never) as Shape;
        expect(clone.top).not.toBe(entity.top);
        expect(clone.facts.name).not.toBe(entity.facts.name);
    });
});

describe('required objects missing from a stored row', () => {
    it('deserialize reads a row that predates a required object as an empty object', () => {
        expect(schema.deserialize({ id: '9' } as never)).toEqual({ id: '9', facts: {} });
    });

    it('serialize writes an absent required object as an empty object', () => {
        expect(schema.serialize({ id: '9' } as never)).toEqual({ id: '9', facts: {} });
    });
});

describe('renamed nullable objects', () => {
    const renamed = s.define('renamed_nullable', {
        id: s.string().key(),
        holder: s.object({ label: s.string().from('label_col') }).from('holder_col').optional().nullable(),
    }).compile();

    it.each([
        ['null', { id: '1', holder_col: null }, { id: '1', holder: null }],
        ['absent', { id: '2' }, { id: '2' }],
        ['present', { id: '3', holder_col: { label_col: 'x' } }, { id: '3', holder: { label: 'x' } }],
    ])('deserialize reads a %s object from its storage name', (_label, stored, expected) => {
        expect(renamed.deserialize(stored as never)).toEqual(expected);
    });

    it.each([
        ['null', { id: '1', holder: null }, { id: '1', holder_col: null }],
        ['present', { id: '3', holder: { label: 'x' } }, { id: '3', holder_col: { label_col: 'x' } }],
    ])('preprocess writes a %s object under its storage name', (_label, entity, expected) => {
        expect(renamed.preprocess(entity as never)).toEqual(expected);
    });
});
