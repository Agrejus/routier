import { describe, expect, it } from '@jest/globals';
import { TranslatedArrayValue } from './TranslatedArrayValue';
import { TranslatedGroupValue } from './TranslatedGroupValue';
import { TranslatedSingleValue } from './TranslatedSingleValue';

describe("translated value wrappers", () => {
    describe("TranslatedArrayValue", () => {
        it("reports empty for null/empty array and non-empty for populated array", () => {
            expect(new TranslatedArrayValue<unknown[]>(null, false).isEmpty).toBe(true);
            expect(new TranslatedArrayValue<unknown[]>([], false).isEmpty).toBe(true);
            expect(new TranslatedArrayValue<unknown[]>([1], false).isEmpty).toBe(false);
        });

        it("forEach can replace items when callback returns a truthy value", () => {
            const wrapped = new TranslatedArrayValue<number[]>([1, 2, 3], false);
            wrapped.forEach((x) => (x as number) * 10);
            expect(wrapped.value).toEqual([10, 20, 30]);
        });

        it("forEach does not replace item when callback returns falsy value", () => {
            const wrapped = new TranslatedArrayValue<number[]>([1, 2], false);
            wrapped.forEach(() => 0);
            expect(wrapped.value).toEqual([1, 2]);
        });
    });

    describe("TranslatedSingleValue", () => {
        it("reports empty when value is null", () => {
            expect(new TranslatedSingleValue<unknown>(null, false).isEmpty).toBe(true);
            expect(new TranslatedSingleValue<number>(1, false).isEmpty).toBe(false);
        });

        it("forEach replaces single value only when callback returns truthy value", () => {
            const wrapped = new TranslatedSingleValue<number>(2, false);
            wrapped.forEach((x) => (x as number) + 3);
            expect(wrapped.value).toBe(5);

            wrapped.forEach(() => 0);
            expect(wrapped.value).toBe(5);
        });
    });

    describe("TranslatedGroupValue", () => {
        it("iterates through all grouped entries and replaces truthy callback results", () => {
            const wrapped = new TranslatedGroupValue<Record<string, number[]>>({
                a: [1, 2],
                b: [3],
            }, false);

            wrapped.forEach((x) => (x as number) * 2);
            expect(wrapped.value).toEqual({
                a: [2, 4],
                b: [6],
            });
        });

        it("does not replace grouped entries for falsy callback results", () => {
            const wrapped = new TranslatedGroupValue<Record<string, number[]>>({
                a: [1, 2],
            }, false);

            wrapped.forEach(() => 0);
            expect(wrapped.value).toEqual({ a: [1, 2] });
        });
    });
});
