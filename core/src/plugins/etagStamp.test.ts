import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { etags, s } from '../schema';
import { stampEtag } from './etagStamp';

const numberEtag = s.define('stamp_numbers', {
    id: s.string().key(),
    version: s.number().etag(etags.numeric),
}).compile().etagProperty;

const stringEtag = s.define('stamp_strings', {
    id: s.string().key(),
    revision: s.string().etag(etags.lexical),
}).compile().etagProperty;

const stampToken = (): string => {
    const item: Record<string, string> = {};
    stampEtag(stringEtag, item, undefined);
    return item.revision ?? '';
};

describe('stampEtag', () => {
    it('does nothing without an etag property', () => {
        const item = { id: 'a' };
        stampEtag(null, item, undefined);

        expect(item).toEqual({ id: 'a' });
    });

    it.each([
        ['no prior row', undefined, 1],
        ['a prior version', { id: 'a', version: 4 }, 5],
        ['a prior row without a version', { id: 'a' }, 1],
        ['a prior version that is not a number', { id: 'a', version: '4' }, 1],
    ])('sets a number etag from %s', (_, prior, expected) => {
        const item: Record<string, number | string> = { id: 'a' };
        stampEtag(numberEtag, item, prior);

        expect(item.version).toBe(expected);
    });

    it('ignores the version the caller sent', () => {
        const item = { id: 'a', version: 40 };
        stampEtag(numberEtag, item, { id: 'a', version: 2 });

        expect(item.version).toBe(3);
    });

    describe('string tokens', () => {

        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('encodes the time then a sequence, fixed width', () => {
            jest.setSystemTime(36 ** 5);

            expect(stampToken()).toMatch(/^000100000000000[0-9a-f]{8}$/);
        });

        it('counts up within the same millisecond', () => {
            jest.setSystemTime(10 ** 12);
            const first = stampToken();
            const second = stampToken();

            expect([first, second].map(token => token.slice(0, 15))).toEqual([`${first.slice(0, 9)}000000`, `${first.slice(0, 9)}000001`]);
        });

        it('restarts the sequence in a later millisecond', () => {
            jest.setSystemTime(2 * 10 ** 12);
            stampToken();
            jest.setSystemTime(2 * 10 ** 12 + 1);

            expect(stampToken().slice(9, 15)).toBe('000000');
        });

        it('keeps increasing when the clock goes backwards', () => {
            jest.setSystemTime(3 * 10 ** 12);
            const before = stampToken();
            jest.setSystemTime(3 * 10 ** 12 - 1000);
            const after = stampToken();

            expect(etags.lexical(before, after)).toBe(-1);
        });

        it('gives tokens made in the same instant different endings', () => {
            jest.setSystemTime(6 * 10 ** 12);

            expect(new Set([stampToken(), stampToken(), stampToken()].map(token => token.slice(15))).size).toBe(3);
        });

        it('ignores the prior token', () => {
            jest.setSystemTime(4 * 10 ** 12);
            const item = { id: 'a', revision: 'zzzzzzzzzzzzzzz' };
            stampEtag(stringEtag, item, { id: 'a', revision: 'zzzzzzzzzzzzzzz' });

            expect(item.revision).not.toBe('zzzzzzzzzzzzzzz');
        });
    });
});
