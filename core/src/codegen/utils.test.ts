import { describe, expect, it } from '@jest/globals';
import { countWordOccurance } from './utils';

describe("codegen utils", () => {
    describe("countWordOccurance", () => {
        it("counts whole-word alphanumeric matches only", () => {
            expect(countWordOccurance("red redder red", "red")).toBe(2);
            expect(countWordOccurance("id _id id2 id", "id")).toBe(2);
        });

        it("counts symbol terms without word-boundary checks", () => {
            expect(countWordOccurance("()=>{} => x => y", "=>")).toBe(3);
            expect(countWordOccurance("a::b::c", "::")).toBe(2);
        });

        it("uses non-overlapping match behavior", () => {
            // For symbol-containing terms, boundary checks are not applied.
            expect(countWordOccurance("====", "==")).toBe(2);
            expect(countWordOccurance("===", "==")).toBe(1);
        });

        it("handles edge cases for empty/oversized search terms", () => {
            expect(countWordOccurance("abc", "")).toBe(0);
            expect(countWordOccurance("ab", "abc")).toBe(0);
        });
    });
});
