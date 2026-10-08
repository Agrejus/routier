import { describe, expect, it } from '@jest/globals';
import { s } from './builder';

describe('a schema whose every root property is a key or identity', () => {
    const keyAndIdentity = s.define('all_keys', { id: s.string().key(), seq: s.number().identity() }).compile();
    const keyOnly = s.define('only_key', { id: s.string().key() }).compile();
    const compositeKeys = s.define('composite_keys', { a: s.string().key(), b: s.number().key() }).compile();

    it('preprocesses a key and an identity', () => {
        expect(keyAndIdentity.preprocess({ id: 'a', seq: 1 } as never)).toEqual({ id: 'a', seq: 1 });
    });

    it('preprocesses a lone key', () => {
        expect(keyOnly.preprocess({ id: 'a' } as never)).toEqual({ id: 'a' });
    });

    it('preprocesses a composite key', () => {
        expect(compositeKeys.preprocess({ a: 'x', b: 2 } as never)).toEqual({ a: 'x', b: 2 });
    });

    it('leaves out an identity that has not been assigned yet', () => {
        expect(keyAndIdentity.preprocess({ id: 'a' } as never)).toEqual({ id: 'a' });
    });

    it('strips a key and an identity down to nothing', () => {
        expect(keyAndIdentity.strip({ id: 'a', seq: 1 } as never)).toEqual({});
    });
});
