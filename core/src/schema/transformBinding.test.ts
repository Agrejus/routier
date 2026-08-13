import { describe, expect, it } from '@jest/globals';
import { s } from './index';

describe('transform bound to a property that does not exist', () => {
    it('says so at compile time rather than silently adding one', () => {
        expect(() => s.define('x', {
            id: s.string().key().identity(),
        }).modify(x => ({
            nope: x.transform({ to: (v: string) => v }),
        })).compile()).toThrow(/not a property of 'x'/);
    });
});
