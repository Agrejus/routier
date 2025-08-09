import { describe, it, expect } from 'vitest';
import { isDate } from './dates';

describe('isDate', () => {
    describe('valid Date objects', () => {
        it('should return true for new Date()', () => {
            const date = new Date();
            expect(isDate(date)).toBe(true);
        });

        it('should return true for Date with specific value', () => {
            const date = new Date('2023-01-15T10:30:00Z');
            expect(isDate(date)).toBe(true);
        });

        it('should return true for Date with timestamp', () => {
            const date = new Date(1673778600000);
            expect(isDate(date)).toBe(true);
        });

        it('should return true for Date with year, month, day', () => {
            const date = new Date(2023, 0, 15); // January 15, 2023
            expect(isDate(date)).toBe(true);
        });

        it('should return true for Date with all parameters', () => {
            const date = new Date(2023, 0, 15, 10, 30, 45, 123);
            expect(isDate(date)).toBe(true);
        });

        it('should return true for Date.now()', () => {
            const date = new Date(Date.now());
            expect(isDate(date)).toBe(true);
        });

        it('should return true for invalid Date object', () => {
            const date = new Date('invalid date string');
            expect(isDate(date)).toBe(true); // Still a Date object, even if invalid
        });
    });

    describe('null and undefined values', () => {
        it('should return false for null', () => {
            expect(isDate(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(isDate(undefined)).toBe(false);
        });

        it('should return false for void 0', () => {
            expect(isDate(void 0)).toBe(false);
        });
    });

    describe('primitive types', () => {
        it('should return false for string', () => {
            expect(isDate('2023-01-15')).toBe(false);
            expect(isDate('not a date')).toBe(false);
            expect(isDate('')).toBe(false);
        });

        it('should return false for number', () => {
            expect(isDate(1673778600000)).toBe(false);
            expect(isDate(0)).toBe(false);
            expect(isDate(-1)).toBe(false);
            expect(isDate(3.14)).toBe(false);
            expect(isDate(NaN)).toBe(false);
            expect(isDate(Infinity)).toBe(false);
            expect(isDate(-Infinity)).toBe(false);
        });

        it('should return false for boolean', () => {
            expect(isDate(true)).toBe(false);
            expect(isDate(false)).toBe(false);
        });

        it('should return false for symbol', () => {
            const symbol = Symbol('test');
            expect(isDate(symbol)).toBe(false);
        });

        it('should return false for bigint', () => {
            expect(isDate(BigInt(1673778600000))).toBe(false);
            expect(isDate(BigInt(0))).toBe(false);
        });
    });

    describe('other object types', () => {
        it('should return false for plain object', () => {
            expect(isDate({})).toBe(false);
            expect(isDate({ year: 2023, month: 1, day: 15 })).toBe(false);
            expect(isDate({ toString: () => '2023-01-15' })).toBe(false);
        });

        it('should return false for array', () => {
            expect(isDate([])).toBe(false);
            expect(isDate([2023, 1, 15])).toBe(false);
            expect(isDate(['2023', '01', '15'])).toBe(false);
        });

        it('should return false for function', () => {
            expect(isDate(() => { })).toBe(false);
            expect(isDate(function () { })).toBe(false);
            expect(isDate(Date)).toBe(false); // Date constructor
        });

        it('should return false for class instance', () => {
            class CustomDate {
                constructor(public value: string) { }
                toString() { return this.value; }
            }
            const customDate = new CustomDate('2023-01-15');
            expect(isDate(customDate)).toBe(false);
        });

        it('should return false for object with date-like properties', () => {
            const dateLike = {
                getTime: () => 1673778600000,
                getFullYear: () => 2023,
                getMonth: () => 0,
                getDate: () => 15,
                toString: () => '2023-01-15T10:30:00.000Z'
            };
            expect(isDate(dateLike)).toBe(false);
        });

        it('should return false for object with instanceof Date check', () => {
            const fakeDate = {
                [Symbol.hasInstance]: () => true
            };
            expect(isDate(fakeDate)).toBe(false);
        });
    });

    describe('special values', () => {
        it('should return false for empty string', () => {
            expect(isDate('')).toBe(false);
        });

        it('should return false for zero', () => {
            expect(isDate(0)).toBe(false);
        });

        it('should return false for negative zero', () => {
            expect(isDate(-0)).toBe(false);
        });

        it('should return false for NaN', () => {
            expect(isDate(NaN)).toBe(false);
        });

        it('should return false for Infinity', () => {
            expect(isDate(Infinity)).toBe(false);
        });

        it('should return false for -Infinity', () => {
            expect(isDate(-Infinity)).toBe(false);
        });
    });

    describe('type safety', () => {
        it('should provide proper type narrowing', () => {
            const unknownValue: unknown = new Date();

            if (isDate(unknownValue)) {
                // TypeScript should know this is a Date here
                expect(unknownValue.getTime()).toBeDefined();
                expect(unknownValue.getFullYear()).toBeDefined();
                expect(unknownValue.toISOString()).toBeDefined();
            } else {
                expect(true).toBe(false); // This should not happen
            }
        });

        it('should work with union types', () => {
            const value: string | Date | null = new Date();

            if (isDate(value)) {
                expect(value.getTime()).toBeDefined();
            } else {
                expect(true).toBe(false); // This should not happen
            }
        });

        it('should work with any type', () => {
            const value: any = new Date();

            if (isDate(value)) {
                expect(value.getTime()).toBeDefined();
            } else {
                expect(true).toBe(false); // This should not happen
            }
        });
    });

    describe('edge cases', () => {
        it('should return false for Date-like objects created without new', () => {
            // Date() without new returns a string representation of current date
            const dateLike = Date();
            expect(isDate(dateLike)).toBe(false);
        });

        it('should return false for objects with date methods but not instanceof Date', () => {
            const dateLike = {
                getTime: () => 1673778600000,
                getFullYear: () => 2023,
                getMonth: () => 0,
                getDate: () => 15,
                toISOString: () => '2023-01-15T10:30:00.000Z'
            };
            expect(isDate(dateLike)).toBe(false);
        });

        it('should return false for null prototype objects', () => {
            const obj = Object.create(null);
            obj.getTime = () => 1673778600000;
            expect(isDate(obj)).toBe(false);
        });

        it('should return true for objects with modified prototype', () => {
            const obj = {};
            Object.setPrototypeOf(obj, Date.prototype);
            expect(isDate(obj)).toBe(true); // This actually works with instanceof Date
        });
    });

    describe('performance characteristics', () => {
        it('should handle large number of checks efficiently', () => {
            const testValues = [
                new Date(),
                '2023-01-15',
                1673778600000,
                null,
                undefined,
                {},
                [],
                true,
                false,
                0,
                '',
                NaN
            ];

            const start = performance.now();

            for (let i = 0; i < 10000; i++) {
                testValues.forEach(value => {
                    isDate(value);
                });
            }

            const end = performance.now();
            const duration = end - start;

            expect(duration).toBeLessThan(100); // Should complete in under 100ms
        });

        it('should handle mixed type arrays efficiently', () => {
            const mixedArray = Array.from({ length: 1000 }, (_, i) => {
                switch (i % 7) {
                    case 0: return new Date();
                    case 1: return 'string';
                    case 2: return 123;
                    case 3: return null;
                    case 4: return undefined;
                    case 5: return {};
                    case 6: return [];
                    default: return true;
                }
            });

            const start = performance.now();
            const results = mixedArray.map(value => isDate(value));
            const end = performance.now();

            expect(results.filter(Boolean)).toHaveLength(Math.ceil(1000 / 7)); // Only Date objects should be true
            expect(end - start).toBeLessThan(50); // Should complete in under 50ms
        });
    });

    describe('real-world scenarios', () => {
        it('should work with API responses', () => {
            const apiResponse = {
                id: 1,
                name: 'Test Item',
                createdAt: new Date('2023-01-15T10:30:00Z'),
                updatedAt: '2023-01-15T10:30:00Z',
                deletedAt: null as any
            };

            expect(isDate(apiResponse.createdAt)).toBe(true);
            expect(isDate(apiResponse.updatedAt)).toBe(false);
            expect(isDate(apiResponse.deletedAt)).toBe(false);
        });

        it('should work with form data', () => {
            const formData = {
                name: 'John Doe',
                email: 'john@example.com',
                birthDate: new Date('1990-05-15'),
                registrationDate: '2023-01-15',
                lastLogin: null as any
            };

            expect(isDate(formData.birthDate)).toBe(true);
            expect(isDate(formData.registrationDate)).toBe(false);
            expect(isDate(formData.lastLogin)).toBe(false);
        });

        it('should work with database records', () => {
            const dbRecord = {
                id: 123,
                title: 'Sample Record',
                created: new Date(),
                modified: new Date(),
                metadata: {
                    lastBackup: new Date('2023-01-01T00:00:00Z'),
                    version: '1.0.0'
                }
            };

            expect(isDate(dbRecord.created)).toBe(true);
            expect(isDate(dbRecord.modified)).toBe(true);
            expect(isDate(dbRecord.metadata.lastBackup)).toBe(true);
            expect(isDate(dbRecord.metadata.version)).toBe(false);
        });

        it('should work with event handlers', () => {
            const eventData = {
                type: 'user_action',
                timestamp: new Date(),
                userId: 456,
                action: 'click',
                metadata: {
                    x: 100,
                    y: 200,
                    timestamp: '2023-01-15T10:30:00Z'
                }
            };

            expect(isDate(eventData.timestamp)).toBe(true);
            expect(isDate(eventData.metadata.timestamp)).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should not throw errors for any input', () => {
            const problematicValues = [
                null,
                undefined,
                {},
                [],
                () => { },
                new Proxy({}, {}),
                new WeakMap(),
                new WeakSet(),
                Symbol(),
                BigInt(123),
                new ArrayBuffer(8),
                new Uint8Array([1, 2, 3])
            ];

            problematicValues.forEach(value => {
                expect(() => isDate(value)).not.toThrow();
            });
        });

        it('should handle objects with circular references', () => {
            const circular: any = {};
            circular.self = circular;

            expect(() => isDate(circular)).not.toThrow();
            expect(isDate(circular)).toBe(false);
        });

        it('should handle objects with getters that throw', () => {
            const obj = {
                get value() {
                    throw new Error('Getter error');
                }
            };

            expect(() => isDate(obj)).not.toThrow();
            expect(isDate(obj)).toBe(false);
        });
    });
}); 