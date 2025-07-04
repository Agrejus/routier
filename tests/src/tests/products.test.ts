import { describe, it, expect, vi, afterAll } from 'vitest';
import { BasicDataStore } from '../contexts/BasicDataStore';
import { product } from '../schemas/product';
import { generateData } from '../data/generator';
import { faker } from '@faker-js/faker';
import { BasicDataStoreFactory } from '../contexts/BasicDataStoreFactory';
import { comment } from '../schemas/comments';
import { event } from '../schemas/event';
import { MemoryPlugin } from 'routier-plugin-memory';
import { uuidv4 } from 'routier-core';

// we can solve this by having a common interface each schema adheres to
// Then we can create a schema for each database to ensure we test everything

const wait = (ms: number) => new Promise<void>((resolve) => {

    let sum = 0;
    const run = () => {
        if (sum >= ms) {
            resolve();
            return;
        }
        sum += 5;
        setTimeout(run, 5);
    }

    run();
});

const seedData = async (routier: BasicDataStore, count: number = 2) => {

    const generatedData = generateData(product, count);

    await routier.products.addAsync(...generatedData);
    await routier.saveChangesAsync();
}

describe('saveChanges', () => {

    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :Can save changes when there are no changes', async () => {
            const result = await routier.saveChangesAsync();
            expect(result).toBe(0);
        });
    });
});

describe('add', () => {
    const factory = BasicDataStoreFactory.create();

    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :Can add a basic product', async () => {
            // Arrange
            const [item] = generateData(product, 1);

            // Act
            const [added] = await routier.products.addAsync(item);
            const response = await routier.saveChangesAsync();

            // Assert
            expect(response).toBe(1);
            expect(added._id).toStrictEqual(expect.any(String));
            expect(added.category).toBe(item.category);
            expect(added.name).toBe(item.name);
            expect(added.inStock).toBe(item.inStock);
            expect(added.price).toBe(item.price);
            expect(added.tags).toEqual(item.tags);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :Can add item with default', async () => {
            // Arrange
            const [item] = generateData(comment, 1);

            // Act
            const [added] = await routier.comments.addAsync(item);
            const response = await routier.saveChangesAsync();

            // Assert
            expect(response).toBe(1);
            expect(added._id).toStrictEqual(expect.any(String));
            expect(added.author).toStrictEqual(item.author);
            expect(added.content).toBe(item.content);
            expect(added.replies).toStrictEqual(item.replies);
            expect(added.createdAt).toBe(item.createdAt);
            expect(added.createdAt).toBeDefined()
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :Can add item with default date', async () => {
            // Arrange
            const [item] = generateData(event, 1);

            // Act
            const [added] = await routier.events.addAsync(item);
            debugger;
            const response = await routier.saveChangesAsync();
            debugger;
            // Assert
            expect(response).toBe(1);
            expect(added.endTime?.toISOString()).toBe(item.endTime?.toISOString());
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :Can add item with default static value', async () => {
            // Arrange
            const [item] = generateData(event, 1);

            // Act
            const [added] = await routier.events.addAsync(item);
            debugger;
            const response = await routier.saveChangesAsync();
            debugger;
            // Assert
            expect(response).toBe(1);
            expect(added.name).toBe(item.name);
            expect(added.name).toBe("James");
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :Can add multiple products', async () => {
            // Arrange
            const items = generateData(product, 2);

            // Act
            const added = await routier.products.addAsync(...items);
            const response = await routier.saveChangesAsync();

            // Assert
            expect(response).toBe(2);
            expect(added).toHaveLength(2);
            added.forEach((product, index) => {
                expect(product._id).toStrictEqual(expect.any(String));
                expect(product.category).toBe(items[index].category);
                expect(product.name).toBe(items[index].name);
                expect(product.inStock).toBe(items[index].inStock);
                expect(product.price).toBe(items[index].price);
                expect(product.tags).toEqual(items[index].tags);
            });
        });
    });
});

describe('remove', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });
    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :removeOne', async () => {
            // Arrange
            await seedData(routier, 2);

            // Act
            const found = await routier.products.firstAsync();
            await routier.products.removeAsync(found);
            const response = await routier.saveChangesAsync();
            expect(response).toBe(1);
            const all = await routier.products.toArrayAsync();
            // Assert
            expect(all.length).toBe(1);
        });
    });
});

describe('update', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :updateOne', async () => {
            // Arrange
            await seedData(routier, 2);
            // Act
            const found = await routier.products.firstAsync();
            const word = faker.lorem.word();
            found.name = word;
            const response = await routier.saveChangesAsync();
            expect(response).toBe(1);
            const foundAfterSave = await routier.products.firstAsync(w => w._id === found._id);
            // Assert
            expect(foundAfterSave.name).toBe(word);
        });
    });
});

describe('toArray', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :all records', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.toArrayAsync();

            // Assert
            expect(found.length).toBe(2);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :toArrayAsync with no seed data', async () => {

            // Act
            const found = await routier.products.toArrayAsync();

            // Assert
            expect(found.length).toBe(0);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + skip + toArrayAsync', async () => {
            // Arrange
            await seedData(routier, 100);

            // Act
            const found = await routier.products.where(w => w._id != "").skip(1).toArrayAsync();

            // Assert
            expect(found.length).toBe(99);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + skip + toArrayAsync', async () => {
            // Arrange
            await seedData(routier, 2);

            // Act
            const found = await routier.products.where(w => w._id != "").sort(w => w.name).skip(1).take(1).toArrayAsync();

            // Assert
            expect(found.length).toBe(1);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + toArrayAsync', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.where(w => w._id != "").toArrayAsync();

            // Assert
            expect(found.length).toBe(2);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :map + toArrayAsync + one property', async () => {
            // Arrange
            await seedData(routier, 100);

            // Act
            const found = await routier.products.map(w => w._id).toArrayAsync()

            // Assert
            expect(found).toBeDefined();
            expect(found.length).toBe(100);
            expect(found[0]).toBeTypeOf("string");
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :sort', async () => {
            // Arrange
            await seedData(routier, 200);

            const sorted = await routier.products.sort(w => w.price).toArrayAsync();

            let last: null | number = null;

            for (const item of sorted) {
                if (last == null) {
                    last = item.price;
                    continue;
                }

                expect(last).toBeLessThanOrEqual(item.price);
                last = item.price;
            }
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :sort descending', async () => {
            // Arrange
            await seedData(routier, 200);

            const sorted = await routier.products.sortDescending(w => w.price).toArrayAsync();

            let last: null | number = null;

            for (const item of sorted) {
                if (last == null) {
                    last = item.price;
                    continue;
                }

                expect(last).toBeGreaterThanOrEqual(item.price);
                last = item.price;
            }
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + where', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const count = await routier.products.where(w => w.price > 100).where(w => w.name.startsWith("s")).toArrayAsync();

            const expectedSum = all.filter(w => w.price > 100 && w.name.startsWith("s"));

            expectedSum.sort();
            count.sort();

            expect(expectedSum).toStrictEqual(count);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + sort + toArrayAsync', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const result = await routier.products
                .where(w => w.price > 100)
                .sortDescending(w => w.price)
                .map(w => w.price)
                .toArrayAsync();

            const expected = all.filter(w => w.price > 100).map(w => w.price);

            expected.sort((a, b) => b - a)


            expect(expected).toStrictEqual(result);
        });
    });
});

describe('first', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :firstAsync with result', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.firstAsync();

            // Assert
            expect(found).toBeDefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :firstAsync with no result', async () => {
            // Act
            expect(routier.products.firstAsync(w => w._id === "SomeMissingId")).rejects.toThrow();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + firstAsync with no result found', async () => {
            // Arrange
            await seedData(routier);

            // Act
            expect(routier.products.where(w => w._id === "SomeMissingId").firstAsync()).rejects.toThrow();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + firstAsync', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.where(w => w._id != "").firstAsync();

            // Assert
            expect(found).toBeDefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :throws: where + firstAsync', async () => {
            // Arrange
            await seedData(routier);

            // Act/Assert
            expect(routier.products.where(w => w._id === "").firstAsync()).rejects.toThrow();
        });
    });
});

describe('firstOrUndefined', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :firstOrUndefinedAsync with result', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :firstOrUndefinedAsync with no result', async () => {

            // Act
            const found = await routier.products.firstOrUndefinedAsync();

            // Assert
            expect(found).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + firstOrUndefinedAsync', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.where(w => w._id != "").firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :map + firstOrUndefinedAsync + one property', async () => {
            // Arrange
            await seedData(routier, 100);

            // Act
            const found = await routier.products.map(w => w._id).firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
            expect(found).toBeTypeOf("string");
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :map + firstOrUndefinedAsync + two properties', async () => {
            // Arrange
            await seedData(routier, 100);

            // Act
            const found = await routier.products.map(w => ({ first: w._id, second: w.inStock })).firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
            expect(found?.first).toBeDefined();
            expect(found?.second).toBeDefined();
        });
    });
});

describe("subscribe", () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :not subscribed should not fire when data changes + firstOrUndefined has query', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.where(w => w._id != "").firstOrUndefined((r, e) => {
                debugger;
                callback(r);
            });

            await wait(500);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0]).toBeDefined();
            expect(callback.mock.calls[0][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when there are additions + firstOrUndefined has query', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeDefined();
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeDefined();
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    it('Subscribe should fire when there are additions + firstOrUndefined has query across data stores', async () => {

        const firstStoreCallback = vi.fn();
        const secondStoreCallback = vi.fn();

        const plugin = new MemoryPlugin(uuidv4());
        const firstStore = BasicDataStore.create(plugin);
        const secondStore = BasicDataStore.create(plugin);

        await seedData(firstStore);

        firstStore.products.subscribe().where(w => w._id != "").firstOrUndefined(firstStoreCallback);
        secondStore.products.subscribe().where(w => w._id != "").firstOrUndefined(secondStoreCallback);

        await firstStore.products.addAsync(...generateData(product, 1));
        await firstStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(firstStoreCallback).toHaveBeenCalledTimes(2);
        expect(firstStoreCallback.mock.calls[0][0]).toBeDefined();
        expect(firstStoreCallback.mock.calls[0][1]).toBeUndefined();

        expect(firstStoreCallback.mock.calls[1][0]).toBeDefined();
        expect(firstStoreCallback.mock.calls[1][1]).toBeUndefined();

        // Assert
        expect(secondStoreCallback).toHaveBeenCalledTimes(2);
        expect(secondStoreCallback.mock.calls[0][0]).toBeDefined();
        expect(secondStoreCallback.mock.calls[0][1]).toBeUndefined();

        expect(secondStoreCallback.mock.calls[1][0]).toBeDefined();
        expect(secondStoreCallback.mock.calls[1][1]).toBeUndefined();
    });

    factory.createDataStores().forEach(async routier => {
        it(routier.pluginName + ' :subscribe should fire when there are updates', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").firstOrUndefined(r => {
                debugger;
                callback(r);
            });

            await wait(500);

            const found = await routier.products.firstAsync(x => x._id != "");

            found.category = "some-new-category"

            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeDefined();
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeDefined();
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(async routier => {
        it(routier.pluginName + ' :subscribe should fire when there are removals', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier, 1);

            // Act
            routier.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

            const found = await routier.products.firstAsync(x => x._id != "");

            await routier.products.removeAsync(found);

            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeDefined();
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeUndefined();
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :not subscribed should not fire when data changes + firstOrUndefined has query', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.where(w => w._id != "").firstOrUndefined(callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0]).toBeDefined();
            expect(callback.mock.calls[0][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + firstOrUndefined has no query', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeDefined();
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeDefined();
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + no query and toArray', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().toArray((r) => {
                expect(r.length).toBeGreaterThan(0);
                callback(r);
            });

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(Array.isArray(callback.mock.calls[0][0])).toBe(true);
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(Array.isArray(callback.mock.calls[1][0])).toBe(true);
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + toArray', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").toArray(callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(Array.isArray(callback.mock.calls[0][0])).toBe(true);
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(Array.isArray(callback.mock.calls[1][0])).toBe(true);
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + sum', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").sum(w => w.price, callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeTypeOf("number");
            expect(callback.mock.calls[0][0]).toBeGreaterThan(0);
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeTypeOf("number");
            expect(callback.mock.calls[1][0]).toBeGreaterThan(0);
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + count', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").map(w => w.price).count(callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeTypeOf("number");
            expect(callback.mock.calls[0][0]).toBe(2);
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeTypeOf("number");
            expect(callback.mock.calls[1][0]).toBe(3);
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + max', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").max(w => w.price, callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeTypeOf("number");
            expect(callback.mock.calls[0][0]).toBeGreaterThan(0);
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeTypeOf("number");
            expect(callback.mock.calls[1][0]).toBeGreaterThan(0);
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + min', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").min(w => w.price, callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback.mock.calls[0][0]).toBeTypeOf("number");
            expect(callback.mock.calls[0][0]).toBeGreaterThan(0);
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(callback.mock.calls[1][0]).toBeTypeOf("number");
            expect(callback.mock.calls[1][0]).toBeGreaterThan(0);
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :subscribe should fire when data changes + distinct', async () => {

            const callback = vi.fn();
            // Arrange
            await seedData(routier);

            // Act
            routier.products.subscribe().where(w => w._id != "").map(w => w.price).distinct(callback);

            await routier.products.addAsync(...generateData(product, 1));
            await routier.saveChangesAsync();

            await wait(500);

            // Assert
            expect(callback).toHaveBeenCalledTimes(2);
            expect(Array.isArray(callback.mock.calls[0][0])).toBe(true);
            expect(callback.mock.calls[0][1]).toBeUndefined();

            expect(Array.isArray(callback.mock.calls[1][0])).toBe(true);
            expect(callback.mock.calls[1][1]).toBeUndefined();
        });
    });
});

describe('every', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :everyAsync = true', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.everyAsync(w => w._id != "");

            // Assert
            expect(found).toBe(true);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :everyAsync = false', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.everyAsync(w => w._id === "");

            // Assert
            expect(found).toBe(false);
        });
    });
});

describe('some', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :someAsync = true', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.someAsync(w => w._id != "");

            // Assert
            expect(found).toBe(true);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :someAsync = false', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.someAsync(w => w._id === "");

            // Assert
            expect(found).toBe(false);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + someAsync', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.where(w => w._id != "").someAsync();

            // Assert
            expect(found).toBeDefined();
        });
    });
});

describe('count', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :countAsync', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const count = await routier.products.map(w => w.price).countAsync();

            expect(all.length).toBe(count);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + countAsync', async () => {
            // Arrange
            await seedData(routier);

            // Act
            const found = await routier.products.where(w => w._id != "").countAsync();

            // Assert
            expect(found).toBe(2);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + countAsync with no data', async () => {
            // Act
            const found = await routier.products.where(w => w._id != "").countAsync();

            // Assert
            expect(found).toBe(0);
        });
    });
});

describe('max', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :max', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const max = await routier.products.maxAsync(w => w.price);

            all.sort((a, b) => b.price - a.price);

            expect(max).toBe(all[0].price);
        });
    });
});

describe('min', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :min', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const min = await routier.products.minAsync(w => w.price);

            all.sort((a, b) => a.price - b.price);

            expect(min).toBe(all[0].price);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + min', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const min = await routier.products.where(w => w.price > 100).minAsync(w => w.price);

            const filtered = all.filter(w => w.price > 100);
            filtered.sort((a, b) => a.price - b.price);

            expect(min).toBe(filtered[0].price);
        });
    });
});

describe('sum', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :sumAsync', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const sum = await routier.products.sumAsync(w => w.price);

            expect(all.reduce((a, v) => a + v.price, 0)).toBe(sum);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + sumAsync', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const count = await routier.products.where(w => w.price > 100).sumAsync(w => w.price);

            const expectedSum = all.filter(w => w.price > 100).reduce((a, v) => a + v.price, 0);
            expect(expectedSum).toBe(count);
        });
    });
});

describe('distinct', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :distinctAsync numbers', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const result = await routier.products.map(w => w.price).distinctAsync();

            const noDups = [...new Set(all.map(w => w.price))];
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :where + distinctAsync numbers', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const result = await routier.products.where(w => w.price > 10).map(w => w.price).distinctAsync();

            const noDups = [...new Set(all.filter(w => w.price > 10).map(w => w.price))];
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :distinctAsync strings', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const result = await routier.products.map(w => w.name).distinctAsync();

            const noDups = [...new Set(all.map(w => w.name))];
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });
    });

    factory.createDataStores().forEach(routier => {
        it(routier.pluginName + ' :distinctAsync dates', async () => {
            // Arrange
            await seedData(routier, 200);

            const all = await routier.products.toArrayAsync();
            const result = await routier.products.map(w => w.createdDate).distinctAsync();

            // deserializer still needs to be run on mappings
            const noDups = [...new Set(all.map(w => w.createdDate.toISOString()))].map(w => new Date(w));
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });
    });
});

describe('attachments', () => {

})