import { describe, it, expect, vi, afterAll } from 'vitest';
import { BasicDataStore } from '../contexts/BasicDataStore';
import { product } from '../schemas/product';
import { generateData } from '../data/generator';
import { faker } from '@faker-js/faker';
import { BasicDataStoreFactory } from '../contexts/BasicDataStoreFactory';
import { comment } from '../schemas/comments';
import { event } from '../schemas/event';
import { MemoryPlugin } from 'routier-plugin-memory';
import { assertIsNotNull, Result, uuidv4 } from 'routier-core';

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

    it('Can save changes when there are no changes', factory.createDataStore(async (dataStore) => {
        const result = await dataStore.saveChangesAsync();
        expect(result.result.count()).toBe(0);
    }));
});

describe('add', () => {
    const factory = BasicDataStoreFactory.create();

    afterAll(async () => {
        await factory.cleanup();
    });

    it('Can add a basic product', factory.createDataStore(async (dataStore) => {
        // Arrange
        const [item] = generateData(product, 1);

        // Act
        const [added] = await dataStore.products.addAsync(item);
        const response = await dataStore.saveChangesAsync();

        // Assert
        expect(response.result.count()).toBe(1);
        expect(added._id).toStrictEqual(expect.any(String));
        expect(added.category).toBe(item.category);
        expect(added.name).toBe(item.name);
        expect(added.inStock).toBe(item.inStock);
        expect(added.price).toBe(item.price);
        expect(added.tags).toEqual(item.tags);
    }));

    it('Can add item with default', factory.createDataStore(async (dataStore) => {
        // Arrange
        const [item] = generateData(comment, 1);

        // Act
        const [added] = await dataStore.comments.addAsync(item);
        const response = await dataStore.saveChangesAsync();

        // Assert
        expect(response.result.count()).toBe(1);
        expect(added._id).toStrictEqual(expect.any(String));
        expect(added.author).toStrictEqual(item.author);
        expect(added.content).toBe(item.content);
        expect(added.replies).toStrictEqual(item.replies);
        expect(added.createdAt).toBe(item.createdAt);
        expect(added.createdAt).toBeDefined()
    }));

    it('Can add item with default date', factory.createDataStore(async (dataStore) => {
        // Arrange
        const [item] = generateData(event, 1);

        // Act
        const [added] = await dataStore.events.addAsync(item);
        const response = await dataStore.saveChangesAsync();
        // Assert
        expect(response.result.count()).toBe(1);
        expect(added.endTime?.toISOString()).toBe(item.endTime?.toISOString());
    }));

    it('Can add item with default static value', factory.createDataStore(async (dataStore) => {
        // Arrange
        const [item] = generateData(event, 1);

        // Act
        const [added] = await dataStore.events.addAsync(item);
        const response = await dataStore.saveChangesAsync();
        // Assert
        expect(response.result.count()).toBe(1);
        expect(added.name).toBe(item.name);
        expect(added.name).toBe("James");
    }));

    it('Can add multiple products', factory.createDataStore(async (dataStore) => {
        // Arrange
        const items = generateData(product, 2);

        // Act
        const added = await dataStore.products.addAsync(...items);
        const response = await dataStore.saveChangesAsync();

        // Assert
        expect(response.result.count()).toBe(2);
        expect(added).toHaveLength(2);
        added.forEach((product, index) => {
            expect(product._id).toStrictEqual(expect.any(String));
            expect(product.category).toBe(items[index].category);
            expect(product.name).toBe(items[index].name);
            expect(product.inStock).toBe(items[index].inStock);
            expect(product.price).toBe(items[index].price);
            expect(product.tags).toEqual(items[index].tags);
        });
    }));
});

describe('remove', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });
    it('removeOne', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 2);

        // Act
        const found = await dataStore.products.firstAsync();
        await dataStore.products.removeAsync(found);
        const response = await dataStore.saveChangesAsync();
        expect(response.result.count()).toBe(1);
        const all = await dataStore.products.toArrayAsync();
        // Assert
        expect(all.length).toBe(1);
    }));
});

describe('update', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('updateOne', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 2);
        // Act
        const found = await dataStore.products.firstAsync();
        const word = faker.lorem.word();
        found.name = word;
        const response = await dataStore.saveChangesAsync();
        expect(response.changes.count()).toBe(1);
        const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);
        // Assert
        expect(foundAfterSave.name).toBe(word);
    }));
});

describe('toArray', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('all records', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.toArrayAsync();

        // Assert
        expect(found.length).toBe(2);
    }));

    it('toArrayAsync with no seed data', factory.createDataStore(async (dataStore) => {

        // Act
        const found = await dataStore.products.toArrayAsync();

        // Assert
        expect(found.length).toBe(0);
    }));

    it('where + skip + toArrayAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 100);

        // Act
        const found = await dataStore.products.where(w => w._id != "").skip(1).toArrayAsync();

        // Assert
        expect(found.length).toBe(99);
    }));

    it('where + skip + toArrayAsync with sort and take', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 2);

        // Act
        const found = await dataStore.products.where(w => w._id != "").sort(w => w.name).skip(1).take(1).toArrayAsync();

        // Assert
        expect(found.length).toBe(1);
    }));

    it('where + toArrayAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.where(w => w._id != "").toArrayAsync();

        // Assert
        expect(found.length).toBe(2);
    }));

    it('map + toArrayAsync + one property', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 100);

        // Act
        const found = await dataStore.products.map(w => w._id).toArrayAsync()

        // Assert
        expect(found).toBeDefined();
        expect(found.length).toBe(100);
        expect(found[0]).toBeTypeOf("string");
    }));

    it('sort', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const sorted = await dataStore.products.sort(w => w.price).toArrayAsync();

        let last: null | number = null;

        for (const item of sorted) {
            if (last == null) {
                last = item.price;
                continue;
            }

            expect(last).toBeLessThanOrEqual(item.price);
            last = item.price;
        }
    }));

    it('sort descending', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const sorted = await dataStore.products.sortDescending(w => w.price).toArrayAsync();

        let last: null | number = null;

        for (const item of sorted) {
            if (last == null) {
                last = item.price;
                continue;
            }

            expect(last).toBeGreaterThanOrEqual(item.price);
            last = item.price;
        }
    }));

    it('where + where', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const count = await dataStore.products.where(w => w.price > 100).where(w => w.name.startsWith("s")).toArrayAsync();

        const expectedSum = all.filter(w => w.price > 100 && w.name.startsWith("s"));

        expectedSum.sort();
        count.sort();

        expect(expectedSum).toStrictEqual(count);
    }));

    it('where + sort + toArrayAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const result = await dataStore.products
            .where(w => w.price > 100)
            .sortDescending(w => w.price)
            .map(w => w.price)
            .toArrayAsync();

        const expected = all.filter(w => w.price > 100).map(w => w.price);

        expected.sort((a, b) => b - a)


        expect(expected).toStrictEqual(result);
    }));
});

describe('first', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('firstAsync with result', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.firstAsync();

        // Assert
        expect(found).toBeDefined();
    }));

    it('firstAsync with no result', factory.createDataStore(async (dataStore) => {
        // Act
        expect(dataStore.products.firstAsync(w => w._id === "SomeMissingId")).rejects.toThrow();
    }));

    it('where + firstAsync with no result found', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        expect(dataStore.products.where(w => w._id === "SomeMissingId").firstAsync()).rejects.toThrow();
    }));

    it('where + firstAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.where(w => w._id != "").firstAsync();

        // Assert
        expect(found).toBeDefined();
    }));

    it('throws: where + firstAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act/Assert
        expect(dataStore.products.where(w => w._id === "").firstAsync()).rejects.toThrow();
    }));
});

describe('firstOrUndefined', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('firstOrUndefinedAsync with result', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.firstOrUndefinedAsync();

        // Assert
        expect(found).toBeDefined();
    }));

    it('firstOrUndefinedAsync with no result', factory.createDataStore(async (dataStore) => {

        // Act
        const found = await dataStore.products.firstOrUndefinedAsync();

        // Assert
        expect(found).toBeUndefined();
    }));

    it('where + firstOrUndefinedAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.where(w => w._id != "").firstOrUndefinedAsync();

        // Assert
        expect(found).toBeDefined();
    }));

    it('map + firstOrUndefinedAsync + one property', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 100);

        // Act
        const found = await dataStore.products.map(w => w._id).firstOrUndefinedAsync();

        // Assert
        expect(found).toBeDefined();
        expect(found).toBeTypeOf("string");
    }));

    it('map + firstOrUndefinedAsync + two properties', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 100);

        // Act
        const found = await dataStore.products.map(w => ({ first: w._id, second: w.inStock })).firstOrUndefinedAsync();

        // Assert
        expect(found).toBeDefined();
        expect(found?.first).toBeDefined();
        expect(found?.second).toBeDefined();
    }));
});

describe("subscribe", () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('not subscribed should not fire when data changes + firstOrUndefined has query', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.where(w => w._id != "").firstOrUndefined((r, e) => {
            debugger;
            callback(r);
        });

        await wait(500);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0][0]).toBeDefined();
        expect(callback.mock.calls[0][1]).toBeUndefined();
    }));

    it('subscribe should fire when there are additions + firstOrUndefined has query', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0]).toBeDefined();
        expect(callback.mock.calls[0][1]).toBeUndefined();

        expect(callback.mock.calls[1][0]).toBeDefined();
        expect(callback.mock.calls[1][1]).toBeUndefined();
    }));

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

    it('Subscribe should fire when there are updates', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

        await wait(500);

        const found = await dataStore.products.firstAsync(x => x._id != "");

        found.category = "some-new-category"

        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0]).toBeDefined();
        expect(callback.mock.calls[0][1]).toBeUndefined();

        expect(callback.mock.calls[1][0]).toBeDefined();
        expect(callback.mock.calls[1][1]).toBeUndefined();
    }));

    it('Subscribe should fire when there are removals', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore, 1);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").firstOrUndefined(r => {
            debugger;
            callback(r)
        });

        const found = await dataStore.products.firstAsync(x => x._id != "");

        await dataStore.products.removeAsync(found);

        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0].data).toBeDefined();
        expect(callback.mock.calls[0][0].ok).toBe(Result.SUCCESS);
        expect(callback.mock.calls[1][0].data).toBeUndefined();
        expect(callback.mock.calls[1][0].ok).toBe(Result.SUCCESS);
    }));

    it('Not subscribed should not fire when data changes + firstOrUndefined has query', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.where(w => w._id != "").firstOrUndefined(callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0][0]).toBeDefined();
    }));

    it('Subscribe should fire when data changes + firstOrUndefined has no query', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0].ok).toBe(Result.SUCCESS);
        expect(callback.mock.calls[0][0].data).toBeDefined();
        expect(callback.mock.calls[1][0].ok).toBe(Result.SUCCESS);
        expect(callback.mock.calls[1][0].data).toBeDefined();
    }));

    it('Subscribe should fire when data changes + no query and toArray', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().toArray((r) => {
            expect(r.ok).toBe(Result.SUCCESS);
            if (r.ok === Result.SUCCESS) {
                expect(r.data.length).toBeGreaterThan(0);
            } else {
                expect(false).toBe(true);
            }

            callback(r);
        });

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(Array.isArray(callback.mock.calls[0][0].data)).toBe(true);

        expect(Array.isArray(callback.mock.calls[1][0].data)).toBe(true);
    }));

    it('Subscribe should fire when data changes + toArray', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").toArray(callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(Array.isArray(callback.mock.calls[0][0].data)).toBe(true);

        expect(Array.isArray(callback.mock.calls[1][0].data)).toBe(true);
    }));

    it('Subscribe should fire when data changes + sum', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").sum(w => w.price, callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[0][0].data).toBeGreaterThan(0);

        expect(callback.mock.calls[1][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[1][0].data).toBeGreaterThan(0);
    }));

    it('Subscribe should fire when data changes + count', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").map(w => w.price).count(callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[0][0].data).toBe(2);

        expect(callback.mock.calls[1][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[1][0].data).toBe(3);
    }));

    it('Subscribe should fire when data changes + max', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").max(w => w.price, callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[0][0].data).toBeGreaterThan(0);

        expect(callback.mock.calls[1][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[1][0].data).toBeGreaterThan(0);
    }));

    it('Subscribe should fire when data changes + min', factory.createDataStore(async (dataStore) => {

        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").min(w => w.price, callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback.mock.calls[0][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[0][0].data).toBeGreaterThan(0);

        expect(callback.mock.calls[1][0].data).toBeTypeOf("number");
        expect(callback.mock.calls[1][0].data).toBeGreaterThan(0);
    }));

    it('Subscribe should fire when data changes + distinct', factory.createDataStore(async (dataStore) => {
        const callback = vi.fn();
        // Arrange
        await seedData(dataStore);

        // Act
        dataStore.products.subscribe().where(w => w._id != "").map(w => w.price).distinct(callback);

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await wait(500);

        // Assert
        expect(callback).toHaveBeenCalledTimes(2);
        expect(Array.isArray(callback.mock.calls[0][0].data)).toBe(true);

        expect(Array.isArray(callback.mock.calls[1][0].data)).toBe(true);
    }));
});

describe('every', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('everyAsync = true', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.everyAsync(w => w._id != "");

        // Assert
        expect(found).toBe(true);
    }));

    it('everyAsync = false', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.everyAsync(w => w._id === "");

        // Assert
        expect(found).toBe(false);
    }));
});

describe('some', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('someAsync = true', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.someAsync(w => w._id != "");

        // Assert
        expect(found).toBe(true);
    }));

    it('someAsync = false', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.someAsync(w => w._id === "");

        // Assert
        expect(found).toBe(false);
    }));

    it('where + someAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.where(w => w._id != "").someAsync();

        // Assert
        expect(found).toBeDefined();
    }));
});

describe('count', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('countAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const count = await dataStore.products.map(w => w.price).countAsync();

        expect(all.length).toBe(count);
    }));

    it('where + countAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore);

        // Act
        const found = await dataStore.products.where(w => w._id != "").countAsync();

        // Assert
        expect(found).toBe(2);
    }));

    it('where + countAsync with no data', factory.createDataStore(async (dataStore) => {
        // Act
        const found = await dataStore.products.where(w => w._id != "").countAsync();

        // Assert
        expect(found).toBe(0);
    }));
});

describe('max', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('max', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const max = await dataStore.products.maxAsync(w => w.price);

        all.sort((a, b) => b.price - a.price);

        expect(max).toBe(all[0].price);
    }));
});

describe('min', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('min', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const min = await dataStore.products.minAsync(w => w.price);

        all.sort((a, b) => a.price - b.price);

        expect(min).toBe(all[0].price);
    }));

    it('where + min', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const min = await dataStore.products.where(w => w.price > 100).minAsync(w => w.price);

        const filtered = all.filter(w => w.price > 100);
        filtered.sort((a, b) => a.price - b.price);

        expect(min).toBe(filtered[0].price);
    }));
});

describe('sum', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('sumAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const sum = await dataStore.products.sumAsync(w => w.price);

        expect(all.reduce((a, v) => a + v.price, 0)).toBe(sum);
    }));

    it('where + sumAsync', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const count = await dataStore.products.where(w => w.price > 100).sumAsync(w => w.price);

        const expectedSum = all.filter(w => w.price > 100).reduce((a, v) => a + v.price, 0);
        expect(expectedSum).toBe(count);
    }));
});

describe('distinct', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('distinctAsync numbers', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const result = await dataStore.products.map(w => w.price).distinctAsync();

        const noDups = [...new Set(all.map(w => w.price))];
        expect(result.length).toBe(noDups.length)
        expect(noDups).toStrictEqual(result);
    }));

    it('where + distinctAsync numbers', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const result = await dataStore.products.where(w => w.price > 10).map(w => w.price).distinctAsync();

        const noDups = [...new Set(all.filter(w => w.price > 10).map(w => w.price))];
        expect(result.length).toBe(noDups.length)
        expect(noDups).toStrictEqual(result);
    }));

    it('distinctAsync strings', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const result = await dataStore.products.map(w => w.name).distinctAsync();

        const noDups = [...new Set(all.map(w => w.name))];
        expect(result.length).toBe(noDups.length)
        expect(noDups).toStrictEqual(result);
    }));


    it('DistinctAsync dates', factory.createDataStore(async (dataStore) => {
        // Arrange
        await seedData(dataStore, 200);

        const all = await dataStore.products.toArrayAsync();
        const result = await dataStore.products.map(w => w.createdDate).distinctAsync();

        // deserializer still needs to be run on mappings
        const noDups = [...new Set(all.map(w => w.createdDate.toISOString()))].map(w => new Date(w));
        expect(result.length).toBe(noDups.length)
        expect(noDups).toStrictEqual(result);
    }));
});

describe('attachments', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should attach entity', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 1);
        const secondDataStore = BasicDataStore.create(new MemoryPlugin(uuidv4()));
        const [added] = await dataStore.products.addAsync(...generatedData);
        await dataStore.saveChangesAsync();

        expect(secondDataStore.products.attachments.has(added)).toBe(false);

        secondDataStore.products.attachments.set(added);

        expect(secondDataStore.products.attachments.has(added)).toBe(true);
    }));

    it('Should detach entity', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 1);
        const [added] = await dataStore.products.addAsync(...generatedData);
        await dataStore.saveChangesAsync();

        dataStore.products.attachments.set(added);
        expect(dataStore.products.attachments.has(added)).toBe(true);

        dataStore.products.attachments.remove(added);
        expect(dataStore.products.attachments.has(added)).toBe(false);
    }));

    it('Should get attached entity', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 1);
        const [added] = await dataStore.products.addAsync(...generatedData);
        await dataStore.saveChangesAsync();

        dataStore.products.attachments.set(added);
        const found = dataStore.products.attachments.get(added);

        expect(found).toBeDefined();
        expect(found?._id).toBe(added._id);
    }));

    it('Should filter attached entities', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 10);
        const instances = dataStore.products.instance(...generatedData);
        dataStore.products.attachments.set(...instances);

        const filtered = dataStore.products.attachments.filter(w => w.price > 100);
        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered.length).toBeGreaterThanOrEqual(0);
    }));

    it('Should find attached entity', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 10);
        const instances = dataStore.products.instance(...generatedData);
        dataStore.products.attachments.set(...instances);

        const found = instances.find(w => w.price > 100)

        const filtered = dataStore.products.attachments.find(w => w.price > 100);
        expect(Array.isArray(filtered)).toBe(false);
        expect(found).toEqual(filtered);
    }));

    it('Should mark entity as dirty', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 1);
        const [added] = await dataStore.products.addAsync(...generatedData);
        await dataStore.saveChangesAsync();

        const instance = dataStore.products.instance(added)[0];
        dataStore.products.attachments.set(instance);
        dataStore.products.attachments.markDirty(instance);

        const changeType = dataStore.products.attachments.getChangeType(instance);
        expect(changeType).toBeDefined();
    }));

    it('Should get change type for attached entity', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 1);
        const [added] = await dataStore.products.addAsync(...generatedData);
        await dataStore.saveChangesAsync();

        const instance = dataStore.products.instance(added)[0];
        dataStore.products.attachments.set(instance);

        const changeType = dataStore.products.attachments.getChangeType(instance);
        expect(changeType).toBeDefined();
    }));

    it('Should return undefined for change type of unattached entity', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 1);
        const [added] = dataStore.products.instance(...generatedData);

        const changeType = dataStore.products.attachments.getChangeType(added);
        expect(changeType).toBeUndefined();
    }));
});

describe('DataStore methods', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should preview changes when no changes exist', factory.createDataStore(async (dataStore) => {
        const changes = await dataStore.previewChangesAsync();
        expect(changes.changes.adds().count()).toBe(0);
        expect(changes.changes.removes().count()).toBe(0);
        expect(changes.changes.count()).toBe(0);
    }));

    it('Should preview changes when entities are added', factory.createDataStore(async (dataStore) => {
        const generatedData = generateData(product, 2);
        await dataStore.products.addAsync(...generatedData);

        const changes = await dataStore.previewChangesAsync();
        expect(changes.changes.adds().count()).toBe(2);
        expect(changes.changes.removes().count()).toBe(0);
        expect(changes.changes.updates().count()).toBe(0);
    }));

    it('Should preview changes when entities are updated', factory.createDataStore(async (dataStore) => {
        const [added] = await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        added.name = "Updated Name";
        const changes = await dataStore.previewChangesAsync();
        expect(changes.changes.adds().count()).toBe(0);
        expect(changes.changes.removes().count()).toBe(0);
        expect(changes.changes.updates().count()).toBe(1);
    }));

    it('Should preview changes when entities are removed', factory.createDataStore(async (dataStore) => {
        const [added] = await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await dataStore.products.removeAsync(added);
        const changes = await dataStore.previewChangesAsync();
        expect(changes.changes.adds().count()).toBe(0);
        expect(changes.changes.removes().count()).toBe(1);
        expect(changes.changes.updates().count()).toBe(0);
    }));

    it('Should check hasChanges when no changes exist', factory.createDataStore(async (dataStore) => {
        const hasChanges = await dataStore.hasChangesAsync();
        expect(hasChanges).toBe(false);
    }));

    it('Should check hasChanges when entities are added', factory.createDataStore(async (dataStore) => {
        await dataStore.products.addAsync(...generateData(product, 1));
        const hasChanges = await dataStore.hasChangesAsync();
        expect(hasChanges).toBe(true);
    }));

    it('Should check hasChanges when entities are updated', factory.createDataStore(async (dataStore) => {
        const [added] = await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        added.name = "Updated Name";
        const hasChanges = await dataStore.hasChangesAsync();
        expect(hasChanges).toBe(true);
    }));

    it('Should check hasChanges when entities are removed', factory.createDataStore(async (dataStore) => {
        const [added] = await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();

        await dataStore.products.removeAsync(added);
        const hasChanges = await dataStore.hasChangesAsync();
        expect(hasChanges).toBe(true);
    }));
});

describe('removeAll', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should remove all entities', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 10);
        const initialCount = await dataStore.products.countAsync();
        expect(initialCount).toBe(10);

        await dataStore.products.removeAllAsync();
        const response = await dataStore.saveChangesAsync();
        expect(response.result.removes().count()).toBe(10);

        const finalCount = await dataStore.products.countAsync();
        expect(finalCount).toBe(0);
    }));

    it('Should remove all entities when collection is empty', factory.createDataStore(async (dataStore) => {
        const initialCount = await dataStore.products.countAsync();
        expect(initialCount).toBe(0);

        await dataStore.products.removeAllAsync();
        const response = await dataStore.saveChangesAsync();
        expect(response.result.removes().count()).toBe(0);

        const finalCount = await dataStore.products.countAsync();
        expect(finalCount).toBe(0);
    }));
});

describe('tag', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should tag entities for addition', factory.createDataStore(async (dataStore) => {
        const [item] = generateData(product, 1);
        dataStore.products.tag("test-tag").add([item], () => { });
        expect(dataStore.products).toBeDefined();
    }));
});

describe('instance', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should create instances and omit id when it is identity', factory.createDataStore(async (dataStore) => {
        const [item] = generateData(product, 1);
        const instances = dataStore.products.instance(item);
        expect(instances.length).toBe(1);
        expect(instances[0]._id).toBeUndefined();
    }));

    it('Should create multiple instances from raw data', factory.createDataStore(async (dataStore) => {
        const items = generateData(product, 3);
        const instances = dataStore.products.instance(...items);
        expect(instances.length).toBe(3);
        instances.forEach(instance => {
            expect(instance.category).toStrictEqual(expect.any(String));
        });
    }));
});

describe('parameterized queries', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should filter with parameterized query', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 100);
        const minPrice = 100;
        const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).toArrayAsync();
        const all = await dataStore.products.toArrayAsync();
        const expected = all.filter(w => w.price > minPrice);
        expect(found.length).toBe(expected.length);
    }));

    it('Should filter with multiple parameters', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 100);
        const params = { minPrice: 50, maxPrice: 200, category: "electronics" };
        const found = await dataStore.products.where(([w, p]) => w.price >= p.minPrice && w.price <= p.maxPrice && w.category === p.category, params).toArrayAsync();
        const all = await dataStore.products.toArrayAsync();
        const expected = all.filter(w => w.price >= params.minPrice && w.price <= params.maxPrice && w.category === params.category);
        expect(found.length).toBe(expected.length);
    }));

    it('Should use parameterized query with first', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 50);
        const minPrice = 100;
        const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).firstAsync();
        expect(found.price).toBeGreaterThan(minPrice);
    }));

    it('Should use parameterized query with firstOrUndefined', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 50);
        const minPrice = 1000;
        const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).firstOrUndefinedAsync();
        expect(found).toBeUndefined();
    }));

    it('Should use parameterized query with count', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 100);
        const minPrice = 100;
        const count = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).countAsync();
        const all = await dataStore.products.toArrayAsync();
        const expected = all.filter(w => w.price > minPrice).length;
        expect(count).toBe(expected);
    }));

    it('Should use parameterized query with sum', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 100);
        const minPrice = 100;
        const sum = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).sumAsync(w => w.price);
        const all = await dataStore.products.toArrayAsync();
        const expected = all.filter(w => w.price > minPrice).reduce((acc, w) => acc + w.price, 0);
        expect(sum).toBe(expected);
    }));
});

describe('take and skip', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should take specified number of entities', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 100);
        const found = await dataStore.products.take(10).toArrayAsync();
        expect(found.length).toBe(10);
    }));

    it('Should skip specified number of entities', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 100);
        const found = await dataStore.products.skip(10).toArrayAsync();
        expect(found.length).toBe(90);
    }));

    it('Should combine where, skip, and take', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 100);
        const found = await dataStore.products.where(w => w.price > 100).skip(5).take(10).toArrayAsync();
        expect(found.length).toBeLessThanOrEqual(10);
    }));

    it('Should handle take with insufficient data', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 5);
        const found = await dataStore.products.take(10).toArrayAsync();
        expect(found.length).toBe(5);
    }));

    it('Should handle skip with insufficient data', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 5);
        const found = await dataStore.products.skip(10).toArrayAsync();
        expect(found.length).toBe(0);
    }));
});

describe('complex queries', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should handle complex query with multiple operations', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 1000);
        const found = await dataStore.products
            .where(w => w.price > 50)
            .sort(w => w.price)
            .skip(10)
            .take(20)
            .map(w => ({ id: w._id, price: w.price }))
            .toArrayAsync();
        expect(found.length).toBeLessThanOrEqual(20);
        expect(found[0]).toHaveProperty('id');
        expect(found[0]).toHaveProperty('price');
    }));

    it('Should handle aggregation query', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 500);
        const totalValue = await dataStore.products
            .where(w => w.inStock)
            .sumAsync(w => w.price);
        expect(totalValue).toBeGreaterThan(0);
    }));

    it('Should handle nested filtering', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 200);
        const found = await dataStore.products
            .where(w => w.price > 100)
            .where(w => w.name.startsWith("s"))
            .where(w => w.category === "electronics")
            .toArrayAsync();
        const all = await dataStore.products.toArrayAsync();
        const expected = all.filter(w => w.price > 100 && w.name.startsWith("s") && w.category === "electronics");
        expect(found.length).toBe(expected.length);
    }));

    it('Should handle complex sorting and mapping', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 200);
        const result = await dataStore.products
            .where(w => w.price > 100)
            .sortDescending(w => w.price)
            .map(w => ({ id: w._id, price: w.price, name: w.name }))
            .take(10)
            .toArrayAsync();
        expect(result.length).toBeLessThanOrEqual(10);
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('price');
        expect(result[0]).toHaveProperty('name');
    }));
});

describe('error handling', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should handle first with no matching entities', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 10);
        await expect(dataStore.products.where(w => w._id === "non-existent").firstAsync()).rejects.toThrow();
    }));

    it('Should handle firstOrUndefined with no matching entities', factory.createDataStore(async (dataStore) => {
        await seedData(dataStore, 10);
        const result = await dataStore.products.where(w => w._id === "non-existent").firstOrUndefinedAsync();
        expect(result).toBeUndefined();
    }));

    it('Should handle min with empty collection', factory.createDataStore(async (dataStore) => {
        await expect(dataStore.products.minAsync(w => w.price)).rejects.toThrow();
    }));

    it('Should handle max with empty collection', factory.createDataStore(async (dataStore) => {
        await expect(dataStore.products.maxAsync(w => w.price)).rejects.toThrow();
    }));

    it('Should handle sum with empty collection', factory.createDataStore(async (dataStore) => {
        const result = await dataStore.products.sumAsync(w => w.price);
        expect(result).toBe(0);
    }));

    it('Should handle count with empty collection', factory.createDataStore(async (dataStore) => {
        const result = await dataStore.products.countAsync();
        expect(result).toBe(0);
    }));
});

describe('subscription management', () => {
    const factory = BasicDataStoreFactory.create();
    afterAll(async () => {
        await factory.cleanup();
    });

    it('Should return unsubscribe function', factory.createDataStore(async (dataStore) => {
        dataStore.events.firstOrUndefined(w => w?._id)
        const unsubscribe = dataStore.products.subscribe().where(w => w._id != null).firstOrUndefined(() => { });
        expect(typeof unsubscribe).toBe('function');
        unsubscribe();
    }));

    it('Should not fire callbacks after unsubscribe', factory.createDataStore(async (dataStore) => {
        const callback = vi.fn();
        await seedData(dataStore);

        const unsubscribe = dataStore.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

        await wait(500);

        unsubscribe();

        await dataStore.products.addAsync(...generateData(product, 1));
        await dataStore.saveChangesAsync();
        await wait(500);

        expect(callback).toHaveBeenCalledTimes(1);
    }));
});