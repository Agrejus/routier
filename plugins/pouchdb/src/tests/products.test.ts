import { faker } from '@faker-js/faker';
import { describe, it, expect, vi, afterAll } from 'vitest';
import { TestDataStore, generateData, wait, seedData } from 'routier-plugin-testing';
import { IDbPlugin, UnknownRecord, uuidv4 } from 'routier-core';
import { PouchDbPlugin } from '../PouchDbPlugin';

const generateDbName = () => `${uuidv4()}-db`;
const pluginFactory: (dbname?: string) => IDbPlugin = (dbname?: string) => new PouchDbPlugin(dbname ?? generateDbName());
const stores: TestDataStore[] = [];
const factory = (dbname?: string) => {

    const store = new TestDataStore(pluginFactory(dbname));

    stores.push(store);

    return store;
};

describe("Product Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Save Operations', () => {
        it("can save changes when there are no changes", async () => {
            const dataStore = factory();
            const result = await dataStore.saveChangesAsync();
            expect(result.aggregate.size).toBe(0);
        });
    });

    describe('Add Operations', () => {
        it("Can add a basic product", async () => {
            const dataStore = factory();
            // Arrange
            const [item] = generateData(dataStore.products.schema, 1);

            // Act
            const [added] = await dataStore.products.addAsync(item);
            const response = await dataStore.saveChangesAsync();

            // Assert
            expect(response.aggregate.size).toBe(1);
            expect(added._id).toStrictEqual(expect.any(String));
            expect(added.category).toBe(item.category);
            expect(added.name).toBe(item.name);
            expect(added.inStock).toBe(item.inStock);
            expect(added.price).toBe(item.price);
            expect(added.tags).toEqual(item.tags);
        });

        it("Can add multiple products", async () => {
            const dataStore = factory();
            // Arrange
            const items = generateData(dataStore.products.schema, 2);

            // Act
            const added = await dataStore.products.addAsync(...items);
            const response = await dataStore.saveChangesAsync();

            // Assert
            expect(response.aggregate.size).toBe(2);
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

        describe("Proxy change tracking", () => {
            it("Add should be a proxy after calling addAsync", async () => {
                const dataStore = factory();
                // Arrange
                const [item] = generateData(dataStore.products.schema, 1);

                // Act
                const [added] = await dataStore.products.addAsync(item);

                // __tracking__ is undefined until saveChanges is called
                expect((added as UnknownRecord).__tracking__).toBeUndefined();
                expect((added as UnknownRecord).__isProxy__).toBe(true);
            });

            it("previewChanges should not set change tracking changes", async () => {
                const dataStore = factory();
                // Arrange
                const [item] = generateData(dataStore.products.schema, 1);

                // Act
                const [added] = await dataStore.products.addAsync(item);

                await dataStore.previewChangesAsync();

                // __tracking__ is undefined until saveChanges is called
                // previewChanges should not set change tracking deltas
                expect((added as UnknownRecord).__tracking__).toBeUndefined();
                expect((added as UnknownRecord).__isProxy__).toBe(true);
            });

            it("hasChanges should not set change tracking changes", async () => {
                const dataStore = factory();
                // Arrange
                const [item] = generateData(dataStore.products.schema, 1);

                // Act
                const [added] = await dataStore.products.addAsync(item);

                const hasChanges = await dataStore.hasChangesAsync();

                // __tracking__ is undefined until saveChanges is called
                // hasChangesAsync should not set change tracking deltas
                expect(hasChanges).toBe(true);
                expect((added as UnknownRecord).__tracking__).toBeUndefined();
                expect((added as UnknownRecord).__isProxy__).toBe(true);
            });

            it("Add should not set the id", async () => {
                const dataStore = factory();
                // Arrange
                const [item] = generateData(dataStore.products.schema, 1);

                // Act
                const [added] = await dataStore.products.addAsync(item);

                expect((added as UnknownRecord)._id).toBeUndefined();
            });

            it("should not mark and entity as dirty when the save result is modified", async () => {
                const dataStore = factory();
                // Arrange
                const [item] = generateData(dataStore.products.schema, 1);

                // Act
                const [added] = await dataStore.products.addAsync(item);

                const responseOne = await dataStore.saveChangesAsync();
                expect(responseOne.aggregate.size).toBe(1);

                added.name === "CHANGED";

                const responseTwo = await dataStore.saveChangesAsync();
                expect(responseTwo.aggregate.size).toBe(0);
            });
        });
    });

    describe('Remove Operations', () => {
        it("can remove one entity", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 2);

            // Act
            const found = await dataStore.products.firstAsync();
            await dataStore.products.removeAsync(found);
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(1);
            const all = await dataStore.products.toArrayAsync();
            // Assert
            expect(all.length).toBe(1);
        });

        it("can remove many entities", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 20);

            // Act
            const found = await dataStore.products.take(10).toArrayAsync();

            expect(found.length).toBe(10);

            await dataStore.products.removeAsync(...found);
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(10);
            const all = await dataStore.products.toArrayAsync();
            // Assert
            expect(all.length).toBe(10);
        });

        it("can remove many entities with a query", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 20);

            // Act
            await dataStore.products.take(10).removeAsync();
            const response = await dataStore.saveChangesAsync();

            expect(response.aggregate.size).toBe(10);
            const all = await dataStore.products.toArrayAsync();

            // Assert
            expect(all.length).toBe(10);
        });

        it("can remove many entities with a query", async () => {
            const dataStore = factory();

            // seedData will call saveChanges
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });

            // Arrange
            await seedData(dataStore, () => dataStore.products, 20);

            // Act
            await dataStore.products.where(x => x.name === "test_name").removeAsync();
            const response = await dataStore.saveChangesAsync();

            expect(response.aggregate.size).toBe(1);
            const all = await dataStore.products.toArrayAsync();

            // Assert
            expect(all.length).toBe(20);
        });
    });

    describe('Update Operations', () => {
        it("should update one item", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 2);
            // Act
            const found = await dataStore.products.firstAsync();
            const word = faker.lorem.word();
            found.name = word;
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(1);
            const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);
            // Assert
            expect(foundAfterSave.name).toBe(word);
        });

        it("should update one item twice", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 2);

            const found = await dataStore.products.firstAsync();
            const firstWord = faker.lorem.word();
            found.name = firstWord;
            const firstResponse = await dataStore.saveChangesAsync();

            expect(firstResponse.aggregate.size).toBe(1);
            const foundAfterFirstSave = await dataStore.products.firstAsync(w => w._id === found._id);
            expect(foundAfterFirstSave.name).toBe(firstWord);

            const secondWord = faker.lorem.word();
            found.name = secondWord;
            const secondResponse = await dataStore.saveChangesAsync();

            const foundAfterSecondSave = await dataStore.products.firstAsync(w => w._id === found._id);
            expect(foundAfterSecondSave.name).toBe(secondWord);
            expect(secondResponse.aggregate.size).toBe(1);
        });

        it("should update many items", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 20);
            // Act
            const found = await dataStore.products.take(10).toArrayAsync();

            for (const product of found) {
                product.name = faker.lorem.word();
                product.price = faker.number.float();
            }

            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(10);
            expect(response.aggregate.updates).toBe(10);
        });

        it("should not save anything when property is reverted to original value", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 2);
            // Act
            const found = await dataStore.products.firstAsync();
            const word = faker.lorem.word();
            const old = found.name;
            found.name = word;
            found.name = old;
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(0);
            const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);
            // Assert
            expect(foundAfterSave.name).toBe(old);
        });

        it("should save the value that was set last", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 2);
            // Act
            const found = await dataStore.products.firstAsync();

            let lastValue = 0;
            for (let i = 0; i < 100; i++) {
                lastValue = 100 * i;
                found.price = lastValue;
            }

            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(1);
            const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);

            // Assert
            expect(foundAfterSave.price).toBe(lastValue);
        });

        it("Can update an array and remove all items", async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });
            await dataStore.saveChangesAsync();

            // Act
            const found = await dataStore.products.firstAsync();
            found.tags = [];
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(1);
            const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);
            // Assert
            expect(foundAfterSave.tags.length).toBe(0);
        });

        it("QUIRK: should not update a nested array if it is not set through assignment", async () => {
            // SOLUTION: Set the property to the expected result
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });
            await dataStore.saveChangesAsync();

            // Act
            const found = await dataStore.products.firstAsync();
            found.tags.length = 0;
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(0);
            const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);
            // Assert - We modified it by ref so it was changed but not saved
            expect(foundAfterSave.tags.length).toBe(0);
        });

        it("should not mark the item as dirty when the property is set to the same value", async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });
            await dataStore.saveChangesAsync();

            // Act
            const found = await dataStore.products.firstAsync();
            found.price = 100;

            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(0);
        });

        it("should force mark an item as dirty and should be saved", async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });
            await dataStore.saveChangesAsync();

            // Act
            const found = await dataStore.products.firstAsync();
            found.price = 100;

            dataStore.products.attachments.markDirty(found);

            dataStore.products.attachments.getChangeType(found);

            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.size).toBe(1);
        });
    });

    describe('Attachment Operations', () => {

        it("Should attach entity", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 1);
            const secondDataStore = factory();
            const [added] = await dataStore.products.addAsync(...generatedData);
            await dataStore.saveChangesAsync();

            expect(secondDataStore.products.attachments.has(added)).toBe(false);

            secondDataStore.products.attachments.set(added);

            expect(secondDataStore.products.attachments.has(added)).toBe(true);
        });

        it("Should attach entity and save update across contexts pointed to the same database", async () => {
            const dbname = generateDbName();
            const dataStore = factory(dbname);
            const generatedData = generateData(dataStore.products.schema, 1);
            const secondDataStore = factory(dbname);
            await dataStore.products.addAsync(...generatedData);
            await dataStore.saveChangesAsync();

            const found = await dataStore.products.firstAsync();

            expect(secondDataStore.products.attachments.has(found)).toBe(false);

            secondDataStore.products.attachments.set(found);

            found.category = "changed_value";

            const result = await secondDataStore.saveChangesAsync();

            expect(result.aggregate.updates).toBe(1);
        });

        it("Should detach entity", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 1);
            const [added] = await dataStore.products.addAsync(...generatedData);
            await dataStore.saveChangesAsync();

            dataStore.products.attachments.set(added);
            expect(dataStore.products.attachments.has(added)).toBe(true);

            dataStore.products.attachments.remove(added);
            expect(dataStore.products.attachments.has(added)).toBe(false);
        });

        it("Should get attached entity", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 1);
            const [added] = await dataStore.products.addAsync(...generatedData);
            await dataStore.saveChangesAsync();

            dataStore.products.attachments.set(added);
            const found = dataStore.products.attachments.get(added);

            expect(found).toBeDefined();
            expect(found?._id).toBe(added._id);
        });

        it("Should filter attached entities", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 10);
            const instances = dataStore.products.instance(...generatedData);
            dataStore.products.attachments.set(...instances);

            const filtered = dataStore.products.attachments.filter(w => w.price > 100);
            expect(Array.isArray(filtered)).toBe(true);
            expect(filtered.length).toBeGreaterThanOrEqual(0);
        });

        it("Should find attached entity", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 10);
            const instances = dataStore.products.instance(...generatedData);
            dataStore.products.attachments.set(...instances);

            const found = instances.find(w => w.price > 100)

            const filtered = dataStore.products.attachments.find(w => w.price > 100);
            expect(Array.isArray(filtered)).toBe(false);
            expect(found).toEqual(filtered);
        });

        it("Should mark entity as dirty", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 1);
            const [added] = await dataStore.products.addAsync(...generatedData);
            await dataStore.saveChangesAsync();

            const instance = dataStore.products.instance(added)[0];
            dataStore.products.attachments.set(instance);
            dataStore.products.attachments.markDirty(instance);

            const changeType = dataStore.products.attachments.getChangeType(instance);
            expect(changeType).toBeDefined();
        });

        it("Should get change type for attached entity", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 1);
            const [added] = await dataStore.products.addAsync(...generatedData);
            await dataStore.saveChangesAsync();

            const instance = dataStore.products.instance(added)[0];
            dataStore.products.attachments.set(instance);

            const changeType = dataStore.products.attachments.getChangeType(instance);
            expect(changeType).toBeDefined();
        });

        it("Should return undefined for change type of unattached entity", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 1);
            const [added] = dataStore.products.instance(...generatedData);

            const changeType = dataStore.products.attachments.getChangeType(added);
            expect(changeType).toBeUndefined();
        });

        it('added items are not attached until saveChanges is called', async () => {
            const dataStore = factory();
            // Arrange
            const [added] = await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });

            const changeType = dataStore.products.attachments.getChangeType(added);

            expect(changeType).toBeUndefined();
        });

        it('added items are not attached until saveChanges is called', async () => {
            const dataStore = factory();
            // Arrange
            const [added] = await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });

            await dataStore.saveChangesAsync();

            const changeType = dataStore.products.attachments.getChangeType(added);

            expect(changeType).toBe("notModified");
        });

        it('should remove an attached item and not be saved', async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });

            await dataStore.saveChangesAsync();

            const found = await dataStore.products.firstAsync();

            found.name = "CHANGED";

            const changeType = dataStore.products.attachments.getChangeType(found);

            expect(changeType).toBe("propertiesChanged");

            dataStore.products.attachments.remove(found);

            const response = await dataStore.saveChangesAsync();

            expect(response.aggregate.size).toBe(0);
        });

        it('should filter attached items', async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            }, {
                category: "test_category",
                inStock: true,
                name: "test_name_2",
                price: 1000,
                tags: ['accessory']
            });

            await dataStore.saveChangesAsync();

            const attachments = dataStore.products.attachments.filter(x => x.category === "test_category");

            expect(attachments.length).toBe(2);
        });

        it('should have attached item', async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });

            await dataStore.saveChangesAsync();

            const found = await dataStore.products.firstAsync();

            expect(dataStore.products.attachments.has(found)).toBe(true);
        });

        it('should get attached item', async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });

            await dataStore.saveChangesAsync();

            const found = await dataStore.products.firstAsync();

            expect(dataStore.products.attachments.get(found)).toEqual(found);
        });

        it('should find attached item', async () => {
            const dataStore = factory();
            // Arrange
            await dataStore.products.addAsync({
                category: "test_category",
                inStock: false,
                name: "test_name",
                price: 100,
                tags: ['accessory']
            });

            await dataStore.saveChangesAsync();

            const found = await dataStore.products.firstAsync();

            expect(dataStore.products.attachments.find(x => x._id === found._id)).toEqual(found);
        });
    })

    describe('ToArray Operations', () => {
        it("all records", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.toArrayAsync();

            // Assert
            expect(found.length).toBe(2);
        });

        it("toArrayAsync with no seed data", async () => {
            const dataStore = factory();
            // Act
            const found = await dataStore.products.toArrayAsync();

            // Assert
            expect(found.length).toBe(0);
        });

        it("where + skip + toArrayAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 100);

            // Act
            const total = await dataStore.products.toArrayAsync();
            const found = await dataStore.products.where(w => w._id != "_________").skip(1).toArrayAsync();

            // Assert
            expect(total.length).toBe(100);
            expect(found.length).toBe(99);
        });

        it("where + skip + toArrayAsync with sort and take", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 2);

            // Act
            const found = await dataStore.products.where(w => w._id != "").sort(w => w.name).skip(1).take(1).toArrayAsync();

            // Assert
            expect(found.length).toBe(1);
        });

        it("where + toArrayAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.where(w => w._id != "").toArrayAsync();

            // Assert
            expect(found.length).toBe(2);
        });

        it("map + toArrayAsync + one property", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 100);

            // Act
            const found = await dataStore.products.map(w => w._id).toArrayAsync()

            // Assert
            expect(found).toBeDefined();
            expect(found.length).toBe(100);
            expect(found[0]).toBeTypeOf("string");
        });

        it("sort", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

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
        });

        it("sort descending", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

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
        });

        it("where + where", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const count = await dataStore.products.where(w => w.price > 100).where(w => w.name.startsWith("s")).toArrayAsync();

            const expectedSum = all.filter(w => w.price > 100 && w.name.startsWith("s"));

            expectedSum.sort();
            count.sort();

            expect(expectedSum).toStrictEqual(count);
        });

        it("where + sort + toArrayAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const result = await dataStore.products
                .where(w => w.price > 100)
                .sortDescending(w => w.price)
                .map(w => w.price)
                .toArrayAsync();

            const expected = all.filter(w => w.price > 100).map(w => w.price);

            expected.sort((a, b) => b - a)

            expect(expected).toStrictEqual(result);
        });
    });

    describe('First Operations', () => {
        it("firstAsync with result", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.firstAsync();

            // Assert
            expect(found).toBeDefined();
        });

        it("firstAsync with no result", async () => {
            const dataStore = factory();
            // Act
            await expect(dataStore.products.firstAsync(w => w._id === "SomeMissingId")).rejects.toThrow();
        });

        it("where + firstAsync with no result found", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            await expect(dataStore.products.where(w => w._id === "SomeMissingId").firstAsync()).rejects.toThrow();
        });

        it("where + firstAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.where(w => w._id != "").firstAsync();

            // Assert
            expect(found).toBeDefined();
        });

        it("throws: where + firstAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act/Assert
            await expect(dataStore.products.where(w => w._id === "").firstAsync()).rejects.toThrow();
        });
    });

    describe('FirstOrUndefined Operations', () => {
        it("firstOrUndefinedAsync with result", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
        });

        it("firstOrUndefinedAsync with no result", async () => {
            const dataStore = factory();
            // Act
            const found = await dataStore.products.firstOrUndefinedAsync();

            // Assert
            expect(found).toBeUndefined();
        });

        it("where + firstOrUndefinedAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.where(w => w._id != "").firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
        });

        it("map + firstOrUndefinedAsync + one property", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 100);

            // Act
            const found = await dataStore.products.map(w => w._id).firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
            expect(found).toBeTypeOf("string");
        });

        it("map + firstOrUndefinedAsync + two properties", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 100);

            // Act
            const found = await dataStore.products.map(w => ({ first: w._id, second: w.inStock })).firstOrUndefinedAsync();

            // Assert
            expect(found).toBeDefined();
            expect(found?.first).toBeDefined();
            expect(found?.second).toBeDefined();
        });
    });

    describe('Every Operations', () => {
        it("everyAsync = true", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.everyAsync(w => w._id != "");

            // Assert
            expect(found).toBe(true);
        });

        it("everyAsync = false", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.everyAsync(w => w._id === "");

            // Assert
            expect(found).toBe(false);
        });
    });

    describe('Some Operations', () => {
        it("someAsync = true", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.someAsync(w => w._id != "");

            // Assert
            expect(found).toBe(true);
        });

        it("someAsync = false", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.someAsync(w => w._id === "");

            // Assert
            expect(found).toBe(false);
        });

        it("where + someAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.where(w => w._id != "").someAsync();

            // Assert
            expect(found).toBeDefined();
        });
    });

    describe('Count Operations', () => {
        it("countAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const count = await dataStore.products.map(w => w.price).countAsync();

            expect(all.length).toBe(count);
        });

        it("where + countAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products);

            // Act
            const found = await dataStore.products.where(w => w._id != "").countAsync();

            // Assert
            expect(found).toBe(2);
        });

        it("where + countAsync with no data", async () => {
            const dataStore = factory();
            // Act
            const found = await dataStore.products.where(w => w._id != "").countAsync();

            // Assert
            expect(found).toBe(0);
        });
    });

    describe('Max Operations', () => {
        it("max", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const max = await dataStore.products.maxAsync(w => w.price);

            all.sort((a, b) => b.price - a.price);

            expect(max).toBe(all[0].price);
        });
    });

    describe('Min Operations', () => {
        it("min", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const min = await dataStore.products.minAsync(w => w.price);

            all.sort((a, b) => a.price - b.price);

            expect(min).toBe(all[0].price);
        });

        it("where + min", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const min = await dataStore.products.where(w => w.price > 100).minAsync(w => w.price);

            const filtered = all.filter(w => w.price > 100);
            filtered.sort((a, b) => a.price - b.price);

            expect(min).toBe(filtered[0].price);
        });
    });

    describe('Sum Operations', () => {
        it("sumAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const sum = await dataStore.products.sumAsync(w => w.price);

            expect(all.reduce((a, v) => a + v.price, 0)).toBe(sum);
        });

        it("where + sumAsync", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const count = await dataStore.products.where(w => w.price > 100).sumAsync(w => w.price);

            const expectedSum = all.filter(w => w.price > 100).reduce((a, v) => a + v.price, 0);
            expect(expectedSum).toBe(count);
        });
    });

    describe('Distinct Operations', () => {
        it("distinctAsync numbers", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const result = await dataStore.products.map(w => w.price).distinctAsync();

            const noDups = [...new Set(all.map(w => w.price))];
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });

        it("where + distinctAsync numbers", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const result = await dataStore.products.where(w => w.price > 10).map(w => w.price).distinctAsync();

            const noDups = [...new Set(all.filter(w => w.price > 10).map(w => w.price))];
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });

        it("distinctAsync strings", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const result = await dataStore.products.map(w => w.name).distinctAsync();

            const noDups = [...new Set(all.map(w => w.name))];
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });

        it("DistinctAsync dates", async () => {
            const dataStore = factory();
            // Arrange
            await seedData(dataStore, () => dataStore.products, 200);

            const all = await dataStore.products.toArrayAsync();
            const result = await dataStore.products.map(w => w.createdDate).distinctAsync();

            // deserializer still needs to be run on mappings
            const noDups = [...new Set(all.map(w => w.createdDate.toISOString()))].map(w => new Date(w));
            expect(result.length).toBe(noDups.length)
            expect(noDups).toStrictEqual(result);
        });
    });

    describe('DataStore Methods', () => {
        it("Should preview changes when no changes exist", async () => {
            const dataStore = factory();
            const changes = await dataStore.previewChangesAsync();
            expect(changes.aggregate.size).toBe(0);
            expect(changes.aggregate.size).toBe(0);
            expect(changes.aggregate.size).toBe(0);
        });

        it("Should preview changes when entities are added", async () => {
            const dataStore = factory();
            const generatedData = generateData(dataStore.products.schema, 2);
            await dataStore.products.addAsync(...generatedData);

            const changes = await dataStore.previewChangesAsync();
            expect(changes.aggregate.adds).toBe(2);
            expect(changes.aggregate.removes).toBe(0);
            expect(changes.aggregate.updates).toBe(0);
        });

        it("Should preview changes when entities are updated", async () => {
            const dataStore = factory();
            const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
            await dataStore.saveChangesAsync();

            added.name = "Updated Name";
            const changes = await dataStore.previewChangesAsync();
            expect(changes.aggregate.adds).toBe(0);
            expect(changes.aggregate.removes).toBe(0);
            expect(changes.aggregate.updates).toBe(1);
        });

        it("Should preview changes when entities are removed", async () => {
            const dataStore = factory();
            const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
            await dataStore.saveChangesAsync();

            await dataStore.products.removeAsync(added);
            const changes = await dataStore.previewChangesAsync();
            expect(changes.aggregate.adds).toBe(0);
            expect(changes.aggregate.removes).toBe(1);
            expect(changes.aggregate.updates).toBe(0);
        });

        it("Should check hasChanges when no changes exist", async () => {
            const dataStore = factory();
            const hasChanges = await dataStore.hasChangesAsync();
            expect(hasChanges).toBe(false);
        });

        it("Should check hasChanges when entities are added", async () => {
            const dataStore = factory();
            await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
            const hasChanges = await dataStore.hasChangesAsync();
            expect(hasChanges).toBe(true);
        });

        it("Should check hasChanges when entities are updated", async () => {
            const dataStore = factory();
            const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
            await dataStore.saveChangesAsync();

            added.name = "Updated Name";
            const hasChanges = await dataStore.hasChangesAsync();
            expect(hasChanges).toBe(true);
        });

        it("Should check hasChanges when entities are removed", async () => {
            const dataStore = factory();
            const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
            await dataStore.saveChangesAsync();

            await dataStore.products.removeAsync(added);
            const hasChanges = await dataStore.hasChangesAsync();
            expect(hasChanges).toBe(true);
        });
    });

    describe('RemoveAll Operations', () => {
        it("Should remove all entities", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            const initialCount = await dataStore.products.countAsync();
            expect(initialCount).toBe(10);

            await dataStore.products.removeAllAsync();
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.removes).toBe(10);

            const finalCount = await dataStore.products.countAsync();
            expect(finalCount).toBe(0);
        });

        it("Should remove all entities when collection is empty", async () => {
            const dataStore = factory();
            const initialCount = await dataStore.products.countAsync();
            expect(initialCount).toBe(0);

            await dataStore.products.removeAllAsync();
            const response = await dataStore.saveChangesAsync();
            expect(response.aggregate.removes).toBe(0);

            const finalCount = await dataStore.products.countAsync();
            expect(finalCount).toBe(0);
        });
    });

    describe('Tag Operations', () => {
        it("Should tag entities for addition", async () => {
            const dataStore = factory();
            const [item] = generateData(dataStore.products.schema, 1);
            dataStore.products.tag("test-tag").add([item], () => { });
            expect(dataStore.products).toBeDefined();
        });
    });

    describe('Instance Operations', () => {
        it("Should create instances and omit id when it is identity", async () => {
            const dataStore = factory();
            const [item] = generateData(dataStore.products.schema, 1);
            const instances = dataStore.products.instance(item);
            expect(instances.length).toBe(1);
            expect(instances[0]._id).toBeUndefined();
        });

        it("Should create multiple instances from raw data", async () => {
            const dataStore = factory();
            const items = generateData(dataStore.products.schema, 3);
            const instances = dataStore.products.instance(...items);
            expect(instances.length).toBe(3);
            instances.forEach(instance => {
                expect(instance.category).toStrictEqual(expect.any(String));
            });
        });
    });

    describe('Parameterized Queries', () => {
        it("Should filter with parameterized query", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 100);
            const minPrice = 100;
            const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).toArrayAsync();
            const all = await dataStore.products.toArrayAsync();
            const expected = all.filter(w => w.price > minPrice);
            expect(found.length).toBe(expected.length);
        });

        it("Should filter with multiple parameters", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 100);
            const params = { minPrice: 50, maxPrice: 200, category: "electronics" };
            const found = await dataStore.products.where(([w, p]) => w.price >= p.minPrice && w.price <= p.maxPrice && w.category === p.category, params).toArrayAsync();
            const all = await dataStore.products.toArrayAsync();
            const expected = all.filter(w => w.price >= params.minPrice && w.price <= params.maxPrice && w.category === params.category);
            expect(found.length).toBe(expected.length);
        });

        it("Should use parameterized query with first", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 50);
            const minPrice = 100;
            const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).firstAsync();
            expect(found.price).toBeGreaterThan(minPrice);
        });

        it("Should use parameterized query with firstOrUndefined", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 50);
            const minPrice = 1000;
            const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).firstOrUndefinedAsync();
            expect(found).toBeUndefined();
        });

        it("Should use parameterized query with count", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 100);
            const minPrice = 100;
            const count = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).countAsync();
            const all = await dataStore.products.toArrayAsync();
            const expected = all.filter(w => w.price > minPrice).length;
            expect(count).toBe(expected);
        });

        it("Should use parameterized query with sum", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 100);
            const minPrice = 100;
            const sum = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).sumAsync(w => w.price);
            const all = await dataStore.products.toArrayAsync();
            const expected = all.filter(w => w.price > minPrice).reduce((acc, w) => acc + w.price, 0);
            expect(sum).toBe(expected);
        });
    });

    describe('Take and Skip Operations', () => {
        it("Should take specified number of entities", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 100);
            const found = await dataStore.products.take(10).toArrayAsync();
            expect(found.length).toBe(10);
        });

        it("Should skip specified number of entities", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 100);
            const found = await dataStore.products.skip(10).toArrayAsync();
            expect(found.length).toBe(90);
        });

        it("Should combine where, skip, and take", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 100);
            const found = await dataStore.products.where(w => w.price > 100).skip(5).take(10).toArrayAsync();
            expect(found.length).toBeLessThanOrEqual(10);
        });

        it("Should handle take with insufficient data", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 5);
            const found = await dataStore.products.take(10).toArrayAsync();
            expect(found.length).toBe(5);
        });

        it("Should handle skip with insufficient data", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 5);
            const found = await dataStore.products.skip(10).toArrayAsync();
            expect(found.length).toBe(0);
        });
    });

    describe('Complex Queries', () => {
        it("Should handle complex query with multiple operations", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 1000);
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
        });

        it("Should handle aggregation query", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 1000);
            const totalValue = await dataStore.products
                .where(w => w.inStock)
                .sumAsync(w => w.price);
            expect(totalValue).toBeGreaterThan(0);
        });

        it("Should handle nested filtering", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 200);
            const found = await dataStore.products
                .where(w => w.price > 100)
                .where(w => w.name.startsWith("s"))
                .where(w => w.category === "electronics")
                .toArrayAsync();
            const all = await dataStore.products.toArrayAsync();
            const expected = all.filter(w => w.price > 100 && w.name.startsWith("s") && w.category === "electronics");
            expect(found.length).toBe(expected.length);
        });

        it("Should handle complex sorting and mapping", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 200);
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
        });
    });

    describe('Error Handling', () => {
        it("Should handle first with no matching entities", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            await expect(dataStore.products.where(w => w._id === "non-existent").firstAsync()).rejects.toThrow();
        });

        it("Should handle firstOrUndefined with no matching entities", async () => {
            const dataStore = factory();
            await seedData(dataStore, () => dataStore.products, 10);
            const result = await dataStore.products.where(w => w._id === "non-existent").firstOrUndefinedAsync();
            expect(result).toBeUndefined();
        });

        it("Should handle min with empty collection", async () => {
            const dataStore = factory();
            await expect(dataStore.products.minAsync(w => w.price)).rejects.toThrow();
        });

        it("Should handle max with empty collection", async () => {
            const dataStore = factory();
            await expect(dataStore.products.maxAsync(w => w.price)).rejects.toThrow();
        });

        it("Should handle sum with empty collection", async () => {
            const dataStore = factory();
            const result = await dataStore.products.sumAsync(w => w.price);
            expect(result).toBe(0);
        });

        it("Should handle count with empty collection", async () => {
            const dataStore = factory();
            const result = await dataStore.products.countAsync();
            expect(result).toBe(0);
        });
    });

    describe('Subscription Management', () => {
        it("Should not fire callbacks after unsubscribe", async () => {
            const dataStore = factory();
            const callback = vi.fn();
            await seedData(dataStore, () => dataStore.products);

            const unsubscribe = dataStore.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

            await wait(500);

            unsubscribe();

            await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
            await dataStore.saveChangesAsync();
            await wait(500);

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });
});