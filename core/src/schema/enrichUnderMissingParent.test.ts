import { describe, expect, it } from '@jest/globals';
import { s } from './builder';

const modes = ['proxy', 'diff', 'immutable'] as const;

const things = s.define('things', {
    id: s.string().key(),
    fact: s.object({
        value: s.object({ items: s.number().array() }).nullable(),
        inner: s.object({ count: s.number().default(1) }),
        label: s.string().default('unnamed'),
        stamp: s.string().default(() => 'stamped'),
    }).optional(),
    tags: s.object({ list: s.array(s.string()).optional() }).optional(),
    settings: s.object({ theme: s.string().default('light') }),
}).compile();

const plain = (entity: object) => JSON.parse(JSON.stringify(entity));

describe.each(modes)('enrich in %s mode', mode => {
    it.each([
        ['an absent optional parent', { id: 'a', settings: {} }, { id: 'a', settings: { theme: 'light' } }],
        ['a null nullable parent of an array', { id: 'b', fact: { value: null, inner: { count: 2 }, label: 'l', stamp: 's' }, settings: { theme: 'dark' } }, { id: 'b', fact: { value: null, inner: { count: 2 }, label: 'l', stamp: 's' }, settings: { theme: 'dark' } }],
        ['an absent optional array', { id: 'c', tags: {}, settings: {} }, { id: 'c', tags: {}, settings: { theme: 'light' } }],
    ])('reads %s without inventing it', (_label, stored, expected) => {
        expect(plain(things.enrich(stored as never, mode))).toEqual(expected);
    });

    it('fills defaults and required objects under a parent that is present', () => {
        expect(plain(things.enrich({ id: 'd', fact: { value: { items: [1] } } } as never, mode))).toEqual({
            id: 'd',
            fact: { value: { items: [1] }, inner: { count: 1 }, label: 'unnamed', stamp: 'stamped' },
            settings: { theme: 'light' },
        });
    });

    it('fills defaults under a required object missing from a stored row', () => {
        expect(plain(things.enrich({ id: 'e' } as never, mode))).toEqual({ id: 'e', settings: { theme: 'light' } });
    });
});
