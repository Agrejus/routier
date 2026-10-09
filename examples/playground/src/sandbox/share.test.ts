import { describe, expect, it } from '@jest/globals';
import { decodeShared, encodeShared } from './share';

describe('sharing code in a link', () => {
    it.each([
        ['plain code', 'console.log("hello");'],
        ['unicode and symbols', 'const café = "naïve ✓"; // €'],
        ['an empty file', ''],
        ['a long file', 'export const x = 1;\n'.repeat(2000)],
    ])('round-trips %s', async (_label, code) => {
        expect(await decodeShared(await encodeShared(code))).toBe(code);
    });

    it.each(Array.from({ length: 12 }, (_, i) => 'x'.repeat(i + 1)))('produces text safe for a URL hash for %s', async code => {
        expect(await encodeShared(code)).toMatch(/^[A-Za-z0-9_-]*$/);
    });

    it('compresses repetitive code', async () => {
        const code = 'await store.items.addAsync({ name: "x" });\n'.repeat(200);

        expect((await encodeShared(code)).length).toBeLessThan(code.length / 10);
    });

    it('returns null for a link that is not valid', async () => {
        expect(await decodeShared('not*valid')).toBeNull();
    });
});
