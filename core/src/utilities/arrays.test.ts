import { describe, it, expect } from '@jest/globals';
import { toMap } from './arrays';

interface TestUser {
    id: number;
    name: string;
    email: string;
    age: number;
    isActive: boolean;
}

interface TestProduct {
    sku: string;
    name: string;
    price: number;
    category: string;
}

describe('toMap', () => {
    describe('basic functionality', () => {
        it('should convert array to map using string key', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false },
                { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: true }
            ];

            const result = toMap(users, (user) => user.name);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(3);
            expect(result.get('Alice')).toEqual(users[0]);
            expect(result.get('Bob')).toEqual(users[1]);
            expect(result.get('Charlie')).toEqual(users[2]);
        });

        it('should convert array to map using number key', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false },
                { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: true }
            ];

            const result = toMap(users, (user) => user.id);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(3);
            expect(result.get(1)).toEqual(users[0]);
            expect(result.get(2)).toEqual(users[1]);
            expect(result.get(3)).toEqual(users[2]);
        });

        it('should convert array to map using boolean key', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false },
                { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: true }
            ];

            const result = toMap(users, (user) => user.isActive);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(2); // Only 2 unique boolean values
            expect(result.get(true)).toEqual(users[2]); // Last one wins for duplicate keys
            expect(result.get(false)).toEqual(users[1]);
        });
    });

    describe('edge cases', () => {
        it('should handle empty array', () => {
            const result = toMap([], (item: any) => item.id);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        it('should handle single item array', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true }
            ];

            const result = toMap(users, (user) => user.name);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(1);
            expect(result.get('Alice')).toEqual(users[0]);
        });

        it('should handle duplicate keys (last item wins)', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Alice', email: 'alice2@example.com', age: 30, isActive: false },
                { id: 3, name: 'Bob', email: 'bob@example.com', age: 35, isActive: true }
            ];

            const result = toMap(users, (user) => user.name);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(2); // Only 2 unique names
            expect(result.get('Alice')).toEqual(users[1]); // Last Alice wins
            expect(result.get('Bob')).toEqual(users[2]);
        });

        it('should handle null and undefined values in key selector', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false }
            ];

            // Test with key selector that could return null/undefined
            const result = toMap(users, (user) => user.age > 30 ? 'old' : 'young');

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(1); // Both users are 'young' (age <= 30)
            expect(result.get('young')).toEqual(users[1]); // Last 'young' user wins
        });
    });

    describe('complex key selectors', () => {
        it('should handle computed keys', () => {
            const products: TestProduct[] = [
                { sku: 'ABC123', name: 'Laptop', price: 999, category: 'Electronics' },
                { sku: 'DEF456', name: 'Mouse', price: 25, category: 'Electronics' },
                { sku: 'GHI789', name: 'Book', price: 15, category: 'Books' }
            ];

            const result = toMap(products, (product) => `${product.category}-${product.sku}`);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(3);
            expect(result.get('Electronics-ABC123')).toEqual(products[0]);
            expect(result.get('Electronics-DEF456')).toEqual(products[1]);
            expect(result.get('Books-GHI789')).toEqual(products[2]);
        });

        it('should handle conditional key selection', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false },
                { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: true }
            ];

            const result = toMap(users, (user) => user.isActive ? `active-${user.id}` : `inactive-${user.id}`);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(3);
            expect(result.get('active-1')).toEqual(users[0]);
            expect(result.get('inactive-2')).toEqual(users[1]);
            expect(result.get('active-3')).toEqual(users[2]);
        });

        it('should handle nested property access', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false }
            ];

            // Simulate nested object access
            const result = toMap(users, (user) => user.email.split('@')[0]);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(2);
            expect(result.get('alice')).toEqual(users[0]);
            expect(result.get('bob')).toEqual(users[1]);
        });
    });

    describe('type safety', () => {
        it('should maintain type safety with different key types', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true }
            ];

            // String key
            const stringMap = toMap(users, (user) => user.name);
            expect(stringMap.get('Alice')).toBeDefined();

            // Number key
            const numberMap = toMap(users, (user) => user.id);
            expect(numberMap.get(1)).toBeDefined();

            // Boolean key
            const booleanMap = toMap(users, (user) => user.isActive);
            expect(booleanMap.get(true)).toBeDefined();
        });

        it('should handle mixed key types in same function', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false }
            ];

            const result = toMap(users, (user) => user.isActive ? user.id : user.name);

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(2);
            expect(result.get(1)).toEqual(users[0]);
            expect(result.get('Bob')).toEqual(users[1]);
        });
    });

    describe('performance characteristics', () => {
        it('should handle large arrays efficiently', () => {
            const largeArray = Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                name: `User${i}`,
                email: `user${i}@example.com`,
                age: 20 + (i % 50),
                isActive: i % 2 === 0
            }));

            const start = performance.now();
            const result = toMap(largeArray, (user) => user.id);
            const end = performance.now();

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(10000);
            expect(result.get(0)).toEqual(largeArray[0]);
            expect(result.get(9999)).toEqual(largeArray[9999]);
            expect(end - start).toBeLessThan(100); // Should complete in under 100ms
        });

        it('should handle many duplicate keys efficiently', () => {
            const arrayWithDuplicates = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                name: i % 10 === 0 ? 'Alice' : `User${i}`,
                email: `user${i}@example.com`,
                age: 20 + (i % 50),
                isActive: i % 2 === 0
            }));

            const start = performance.now();
            const result = toMap(arrayWithDuplicates, (user) => user.name);
            const end = performance.now();

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBeLessThan(1000); // Fewer unique keys due to duplicates
            expect(result.get('Alice')).toBeDefined(); // Last Alice should be in map
            expect(end - start).toBeLessThan(50); // Should complete in under 50ms
        });
    });

    describe('error handling', () => {
        it('should handle key selector that throws error', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false }
            ];

            expect(() => {
                toMap(users, (user) => {
                    if (user.id === 1) {
                        throw new Error('Test error');
                    }
                    return user.name;
                });
            }).toThrow('Test error');
        });

        it('should handle null/undefined in input array', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                null as any,
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false }
            ];

            expect(() => {
                toMap(users, (user) => user.name);
            }).toThrow(); // Should throw when trying to access .name on null
        });
    });

    describe('real-world scenarios', () => {
        it('should work with user management system', () => {
            const users: TestUser[] = [
                { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, isActive: true },
                { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, isActive: false },
                { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 35, isActive: true }
            ];

            // Create maps for different lookup scenarios
            const idMap = toMap(users, (user) => user.id);
            const emailMap = toMap(users, (user) => user.email);
            const activeStatusMap = toMap(users, (user) => user.isActive);

            expect(idMap.get(1)?.name).toBe('Alice');
            expect(emailMap.get('bob@example.com')?.id).toBe(2);
            expect(activeStatusMap.get(true)?.name).toBe('Charlie'); // Last active user
        });

        it('should work with e-commerce product catalog', () => {
            const products: TestProduct[] = [
                { sku: 'LAPTOP001', name: 'Gaming Laptop', price: 1299, category: 'Electronics' },
                { sku: 'MOUSE001', name: 'Wireless Mouse', price: 29, category: 'Electronics' },
                { sku: 'BOOK001', name: 'Programming Guide', price: 45, category: 'Books' },
                { sku: 'LAPTOP002', name: 'Business Laptop', price: 899, category: 'Electronics' }
            ];

            // Create maps for different lookup scenarios
            const skuMap = toMap(products, (product) => product.sku);
            const categoryMap = toMap(products, (product) => product.category);
            const priceRangeMap = toMap(products, (product) =>
                product.price > 1000 ? 'premium' : product.price > 100 ? 'mid-range' : 'budget'
            );

            expect(skuMap.get('LAPTOP001')?.name).toBe('Gaming Laptop');
            expect(categoryMap.get('Electronics')?.name).toBe('Business Laptop'); // Last electronics product
            expect(priceRangeMap.get('premium')?.sku).toBe('LAPTOP001');
            expect(priceRangeMap.get('budget')?.sku).toBe('BOOK001'); // Last budget item wins
        });
    });
}); 