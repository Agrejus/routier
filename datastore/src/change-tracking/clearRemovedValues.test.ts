import { describe, expect, it } from '@jest/globals';
import { PropertyInfo, s } from '@routier/core/schema';
import { clearRemovedValues } from './clearRemovedValues';

const schema = s.define('clear_removed', {
    id: s.string().key(),
    note: s.string().nullable(),
    label: s.string().optional(),
    box: s.object({ inner: s.string().nullable(), deep: s.object({ leaf: s.string().optional() }) }).nullable(),
    list: s.array(s.object({ k: s.string() })),
}).modify(x => ({
    derived: x.computed(entity => entity.id.length),
    greet: x.function(entity => (greeting: string) => `${greeting} ${entity.id}`),
})).compile();

const properties = schema.properties as PropertyInfo<{}>[];

const cleared = (destination: Record<string, unknown>, source: Record<string, unknown>) => {
    clearRemovedValues(destination, source, properties);
    return destination;
};

describe('clearRemovedValues', () => {
    it('sets a value the source holds as null', () => {
        expect(cleared({ id: 'a', note: 'x' }, { id: 'a', note: null })).toEqual({ id: 'a', note: null });
    });

    it.each([
        ['missing', { id: 'a' }],
        ['undefined', { id: 'a', label: undefined }],
    ])('removes a value the source has %s', (_label, source) => {
        expect(cleared({ id: 'a', label: 'y' }, source)).toEqual({ id: 'a' });
    });

    it('leaves a value the source still holds', () => {
        expect(cleared({ id: 'a', note: 'x', label: 'y' }, { id: 'a', note: 'other', label: 'z' })).toEqual({ id: 'a', note: 'x', label: 'y' });
    });

    it('clears inside a nested object at every depth', () => {
        expect(cleared(
            { id: 'a', box: { inner: 'z', deep: { leaf: 'l' } } },
            { id: 'a', box: { inner: null, deep: {} } },
        )).toEqual({ id: 'a', box: { inner: null, deep: {} } });
    });

    it('sets a nullable object the source holds as null', () => {
        expect(cleared({ id: 'a', box: { inner: 'z', deep: {} } }, { id: 'a', box: null })).toEqual({ id: 'a', box: null });
    });

    it('does not reach into an array', () => {
        const list = [{ k: 'kept' }];

        expect(cleared({ id: 'a', list }, { id: 'a', list: [{}] })).toEqual({ id: 'a', list: [{ k: 'kept' }] });
    });

    it('leaves a computed value alone', () => {
        expect(cleared({ id: 'a', derived: 1 }, { id: 'a' })).toEqual({ id: 'a', derived: 1 });
    });

    it('does not recurse when the destination object is missing', () => {
        expect(cleared({ id: 'a' }, { id: 'a', box: { inner: null, deep: {} } })).toEqual({ id: 'a' });
    });

    it('leaves a function alone', () => {
        const greet = () => 'hi';

        expect(cleared({ id: 'a', greet }, { id: 'a' })).toEqual({ id: 'a', greet });
    });

    it('does not recurse when the destination object is null', () => {
        expect(cleared({ id: 'a', box: null }, { id: 'a', box: { inner: null, deep: {} } })).toEqual({ id: 'a', box: null });
    });
});
