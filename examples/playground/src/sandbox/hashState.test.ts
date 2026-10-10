import { describe, expect, it } from '@jest/globals';
import { hashFor, parseHash } from './hashState';

describe('the playground hash', () => {
    it.each([
        ['an example', '#crud', { id: 'crud', shared: null }],
        ['an example with shared code', '#sqlite&code=abc_-1', { id: 'sqlite', shared: 'abc_-1' }],
        ['no hash', '', { id: null, shared: null }],
        ['only a hash sign', '#', { id: null, shared: null }],
        ['a hash without its leading sign, keeping later ones', 'notes#2', { id: 'notes#2', shared: null }],
    ])('reads %s', (_label, hash, expected) => {
        expect(parseHash(hash)).toEqual(expected);
    });

    it.each([
        ['an example', 'crud', null, '#crud'],
        ['shared code', 'sqlite', 'abc_-1', '#sqlite&code=abc_-1'],
    ])('writes %s', (_label, id, shared, expected) => {
        expect(hashFor(id, shared)).toBe(expected);
    });
});
