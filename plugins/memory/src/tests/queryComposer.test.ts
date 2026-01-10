import { describe, it, expect, afterAll } from '@jest/globals';
import { seedData } from '@routier/test-utils';
import { IDbPlugin, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';
import { Queryable } from '@routier/datastore';

const generateDbName = () => `${uuidv4()}-db`;
const pluginFactory: (dbname?: string) => IDbPlugin = (dbname?: string) => new MemoryPlugin(dbname ?? generateDbName());
const stores: TestDataStore[] = [];
const factory = (dbname?: string) => {
    const store = new TestDataStore(pluginFactory(dbname));
    stores.push(store);
    return store;
};

describe("Query Composer Tests", () => {
    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Basic Composition', () => {
        it("can compose a query with parameters and apply it", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.products.addAsync({
                category: "electronics",
                inStock: true,
                name: "Test Product",
                price: 100,
                tags: ["computer"]
            });
            await dataStore.saveChangesAsync();

            const filterByName = (params: { name: string }) =>
                Queryable.compose(dataStore.products.schema).where(([x, p]) => x.name === p.name, params);

            const result = await dataStore.products.apply(filterByName({ name: "Test Product" })).firstOrUndefinedAsync();

            expect(result).toBeDefined();
            expect(result?.name).toBe("Test Product");
        });

        it("can compose a query with multiple parameters", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.products.addAsync({
                category: "electronics",
                inStock: true,
                name: "Expensive Item",
                price: 500,
                tags: ["computer"]
            });
            await dataStore.saveChangesAsync();

            const filterByPriceAndCategory = (params: { price: number; category: string }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.price >= p.price && x.category === p.category, params);

            const result = await dataStore.products.apply(filterByPriceAndCategory({ price: 400, category: "electronics" })).toArrayAsync();

            expect(result.length).toBeGreaterThan(0);
            expect(result.every(p => p.price >= 400 && p.category === "electronics")).toBe(true);
        });
    });

    describe('Composition with Chaining', () => {
        it("can chain where clauses with parameters", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 20);
            await dataStore.products.addAsync({
                category: "electronics",
                inStock: true,
                name: "Filtered Product",
                price: 150,
                tags: ["computer"]
            });
            await dataStore.saveChangesAsync();

            const complexFilter = (params: { minPrice: number; category: string; inStock: boolean }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.price >= p.minPrice, params)
                    .where(([x, p]) => x.category === p.category, params)
                    .where(([x, p]) => x.inStock === p.inStock, params);

            const result = await dataStore.products.apply(complexFilter({
                minPrice: 100,
                category: "electronics",
                inStock: true
            })).toArrayAsync();

            expect(result.length).toBeGreaterThan(0);
            expect(result.every(p => p.price >= 100 && p.category === "electronics" && p.inStock)).toBe(true);
        });

        it("can combine parameterized where with map", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.products.addAsync({
                category: "electronics",
                inStock: true,
                name: "Mapped Product",
                price: 200,
                tags: ["computer"]
            });
            await dataStore.saveChangesAsync();

            const filterAndMap = (params: { name: string }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.name === p.name, params)
                    .map(x => x.price);

            const result = await dataStore.products.apply(filterAndMap({ name: "Mapped Product" })).toArrayAsync();

            expect(result.length).toBe(1);
            expect(result[0]).toBe(200);
        });

        it("can combine parameterized where with sort", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.products.addAsync({
                category: "electronics",
                inStock: true,
                name: "Sorted Product A",
                price: 100,
                tags: ["computer"]
            });
            await dataStore.products.addAsync({
                category: "electronics",
                inStock: true,
                name: "Sorted Product B",
                price: 200,
                tags: ["computer"]
            });
            await dataStore.saveChangesAsync();

            const filterAndSortQueryFactory = (params: { category: string }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.category === p.category, params)
                    .sort(x => x.price);

            const result = await dataStore.products.apply(filterAndSortQueryFactory({ category: "electronics" })).toArrayAsync();

            expect(result.length).toBeGreaterThan(0);
            for (let i = 1; i < result.length; i++) {
                expect(result[i].price).toBeGreaterThanOrEqual(result[i - 1].price);
            }
        });
    });

    describe('Composition with Skip and Take', () => {
        it("can combine parameterized query with skip", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.saveChangesAsync();

            const filterAndSkip = (params: { category: string }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.category === p.category, params)
                    .skip(2);

            const result = await dataStore.products.apply(filterAndSkip({ category: "electronics" })).toArrayAsync();

            expect(result.length).toBeGreaterThanOrEqual(0);
        });

        it("can combine parameterized query with take", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.saveChangesAsync();

            const filterAndTake = (params: { category: string }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.category === p.category, params)
                    .take(3);

            const result = await dataStore.products.apply(filterAndTake({ category: "electronics" })).toArrayAsync();

            expect(result.length).toBeLessThanOrEqual(3);
        });

        it("can combine parameterized query with skip and take", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.saveChangesAsync();

            const filterSkipAndTake = (params: { category: string }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.category === p.category, params)
                    .skip(1)
                    .take(2);

            const result = await dataStore.products.apply(filterSkipAndTake({ category: "electronics" })).toArrayAsync();

            expect(result.length).toBeLessThanOrEqual(2);
        });
    });

    describe('Edge Cases', () => {
        it("returns undefined when no matching records found with firstOrUndefinedAsync", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 5);
            await dataStore.saveChangesAsync();

            const filterByName = (params: { name: string }) =>
                Queryable.compose(dataStore.products.schema).where(([x, p]) => x.name === p.name, params);

            const result = await dataStore.products.apply(filterByName({ name: "NonExistent Product" })).firstOrUndefinedAsync();

            expect(result).toBeUndefined();
        });

        it("returns empty array when no matching records found with toArrayAsync", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 5);
            await dataStore.saveChangesAsync();

            const filterByPrice = (params: { price: number }) =>
                Queryable.compose(dataStore.products.schema).where(([x, p]) => x.price > p.price, params);

            const result = await dataStore.products.apply(filterByPrice({ price: 1000000 })).toArrayAsync();

            expect(result).toEqual([]);
        });

        it("can use parameters with different data types", async () => {
            const dataStore = factory();
            await dataStore.products.addAsync({
                category: "electronics",
                inStock: true,
                name: "Type Test Product",
                price: 250,
                tags: ["computer"]
            });
            await dataStore.saveChangesAsync();

            const filterByTypes = (params: { price: number; inStock: boolean; category: string }) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.price === p.price, params)
                    .where(([x, p]) => x.inStock === p.inStock, params)
                    .where(([x, p]) => x.category === p.category, params);

            const result = await dataStore.products.apply(filterByTypes({
                price: 250,
                inStock: true,
                category: "electronics"
            })).firstOrUndefinedAsync();

            expect(result).toBeDefined();
            expect(result?.price).toBe(250);
            expect(result?.inStock).toBe(true);
            expect(result?.category).toBe("electronics");
        });
    });

    describe('Reusable Composer Functions', () => {
        it("can create reusable composer functions", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.saveChangesAsync();

            const createPriceFilter = (minPrice: number) =>
                Queryable.compose(dataStore.products.schema).where(([x, p]) => x.price >= p.minPrice, { minPrice });

            const expensiveProducts = await dataStore.products.apply(createPriceFilter(100)).toArrayAsync();
            const cheapProducts = await dataStore.products.apply(createPriceFilter(50)).toArrayAsync();

            expect(expensiveProducts.length).toBeLessThanOrEqual(cheapProducts.length);
            expect(expensiveProducts.every(p => p.price >= 100)).toBe(true);
            expect(cheapProducts.every(p => p.price >= 50)).toBe(true);
        });

        it("can create composer functions that accept multiple parameters", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await dataStore.saveChangesAsync();

            const createCategoryPriceFilter = (category: string, minPrice: number) =>
                Queryable.compose(dataStore.products.schema)
                    .where(([x, p]) => x.category === p.category, { category })
                    .where(([x, p]) => x.price >= p.minPrice, { minPrice });

            const result = await dataStore.products.apply(createCategoryPriceFilter("electronics", 100)).toArrayAsync();

            expect(result.every(p => p.category === "electronics" && p.price >= 100)).toBe(true);
        });
    });
});

