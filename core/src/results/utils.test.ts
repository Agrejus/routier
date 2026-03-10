import { describe, expect, it } from '@jest/globals';
import { Result } from './Result';
import { toPromise } from './utils';

describe("results utils", () => {
    it("toPromise resolves with success result data", async () => {
        const value = await toPromise<number>((done) => done(Result.success(42)));
        expect(value).toBe(42);
    });

    it("toPromise rejects with error result error", async () => {
        const error = new Error("boom");

        await expect(
            toPromise<number>((done) => done(Result.error(error)))
        ).rejects.toBe(error);
    });
});
