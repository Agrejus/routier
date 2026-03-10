import { describe, expect, it } from '@jest/globals';
import { uuid, uuidv4 } from './uuid';

describe("uuid utilities", () => {
    it("uuid() returns alphanumeric string with requested length", () => {
        const value = uuid(24);

        expect(value).toHaveLength(24);
        expect(/^[A-Za-z0-9]+$/.test(value)).toBe(true);
    });

    it("uuid() uses default length of 16", () => {
        const value = uuid();
        expect(value).toHaveLength(16);
    });

    it("uuidv4() returns RFC4122 v4-compatible format", () => {
        const value = uuidv4();

        // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx, y in [8,9,a,b]
        expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});
