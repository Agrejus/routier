import { TestSuiteBase } from './base';
import { generateData } from '../utils/dataGenerator';
import { wait, seedData } from '../utils';
import { faker } from '@faker-js/faker';

export class ProductTestSuite extends TestSuiteBase {


    override getTestSuites() {
        const expect = this.testingOptions.expect;

        return [
            {
                name: "Save Operations",
                testCases: [this.createTestCase("can save changes when there are no changes", (factory) => async () => {
                    const dataStore = factory();
                    const result = await dataStore.saveChangesAsync();
                    expect(result.result.count()).toBe(0);
                })]
            },
            {
                name: "Add Operations",
                testCases: [
                    this.createTestCase("Can add a basic product", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        const [item] = generateData(dataStore.products.schema, 1);

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
                    }),
                    this.createTestCase("Can add multiple products", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        const items = generateData(dataStore.products.schema, 2);

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
                    })
                ]
            },
            {
                name: "Remove Operations",
                testCases: [
                    this.createTestCase("removeOne", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 2);

                        // Act
                        const found = await dataStore.products.firstAsync();
                        await dataStore.products.removeAsync(found);
                        const response = await dataStore.saveChangesAsync();
                        expect(response.result.count()).toBe(1);
                        const all = await dataStore.products.toArrayAsync();
                        // Assert
                        expect(all.length).toBe(1);
                    })
                ]
            },
            {
                name: "Update Operations",
                testCases: [
                    this.createTestCase("updateOne", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 2);
                        // Act
                        const found = await dataStore.products.firstAsync();
                        const word = faker.lorem.word();
                        found.name = word;
                        const response = await dataStore.saveChangesAsync();
                        expect(response.changes.count()).toBe(1);
                        const foundAfterSave = await dataStore.products.firstAsync(w => w._id === found._id);
                        // Assert
                        expect(foundAfterSave.name).toBe(word);
                    })
                ]
            },
            {
                name: "ToArray Operations",
                testCases: [
                    this.createTestCase("all records", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.toArrayAsync();

                        // Assert
                        expect(found.length).toBe(2);
                    }),
                    this.createTestCase("toArrayAsync with no seed data", (factory) => async () => {
                        const dataStore = factory();
                        // Act
                        const found = await dataStore.products.toArrayAsync();

                        // Assert
                        expect(found.length).toBe(0);
                    }),
                    this.createTestCase("where + skip + toArrayAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 100);

                        // Act
                        const found = await dataStore.products.where(w => w._id != "").skip(1).toArrayAsync();

                        // Assert
                        expect(found.length).toBe(99);
                    }),
                    this.createTestCase("where + skip + toArrayAsync with sort and take", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 2);

                        // Act
                        const found = await dataStore.products.where(w => w._id != "").sort(w => w.name).skip(1).take(1).toArrayAsync();

                        // Assert
                        expect(found.length).toBe(1);
                    }),
                    this.createTestCase("where + toArrayAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.where(w => w._id != "").toArrayAsync();

                        // Assert
                        expect(found.length).toBe(2);
                    }),
                    this.createTestCase("map + toArrayAsync + one property", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 100);

                        // Act
                        const found = await dataStore.products.map(w => w._id).toArrayAsync()

                        // Assert
                        expect(found).toBeDefined();
                        expect(found.length).toBe(100);
                        expect(found[0]).toBeTypeOf("string");
                    }),
                    this.createTestCase("sort", (factory) => async () => {
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
                    }),
                    this.createTestCase("sort descending", (factory) => async () => {
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
                    }),
                    this.createTestCase("where + where", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const count = await dataStore.products.where(w => w.price > 100).where(w => w.name.startsWith("s")).toArrayAsync();

                        const expectedSum = all.filter(w => w.price > 100 && w.name.startsWith("s"));

                        expectedSum.sort();
                        count.sort();

                        expect(expectedSum).toStrictEqual(count);
                    }),
                    this.createTestCase("where + sort + toArrayAsync", (factory) => async () => {
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
                    })
                ]
            },
            {
                name: "First Operations",
                testCases: [
                    this.createTestCase("firstAsync with result", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.firstAsync();

                        // Assert
                        expect(found).toBeDefined();
                    }),
                    this.createTestCase("firstAsync with no result", (factory) => async () => {
                        const dataStore = factory();
                        // Act
                        await expect(dataStore.products.firstAsync(w => w._id === "SomeMissingId")).rejects.toThrow();
                    }),
                    this.createTestCase("where + firstAsync with no result found", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        await expect(dataStore.products.where(w => w._id === "SomeMissingId").firstAsync()).rejects.toThrow();
                    }),
                    this.createTestCase("where + firstAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.where(w => w._id != "").firstAsync();

                        // Assert
                        expect(found).toBeDefined();
                    }),
                    this.createTestCase("throws: where + firstAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act/Assert
                        await expect(dataStore.products.where(w => w._id === "").firstAsync()).rejects.toThrow();
                    })
                ]
            },
            {
                name: "FirstOrUndefined Operations",
                testCases: [
                    this.createTestCase("firstOrUndefinedAsync with result", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.firstOrUndefinedAsync();

                        // Assert
                        expect(found).toBeDefined();
                    }),
                    this.createTestCase("firstOrUndefinedAsync with no result", (factory) => async () => {
                        const dataStore = factory();
                        // Act
                        const found = await dataStore.products.firstOrUndefinedAsync();

                        // Assert
                        expect(found).toBeUndefined();
                    }),
                    this.createTestCase("where + firstOrUndefinedAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.where(w => w._id != "").firstOrUndefinedAsync();

                        // Assert
                        expect(found).toBeDefined();
                    }),
                    this.createTestCase("map + firstOrUndefinedAsync + one property", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 100);

                        // Act
                        const found = await dataStore.products.map(w => w._id).firstOrUndefinedAsync();

                        // Assert
                        expect(found).toBeDefined();
                        expect(found).toBeTypeOf("string");
                    }),
                    this.createTestCase("map + firstOrUndefinedAsync + two properties", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 100);

                        // Act
                        const found = await dataStore.products.map(w => ({ first: w._id, second: w.inStock })).firstOrUndefinedAsync();

                        // Assert
                        expect(found).toBeDefined();
                        expect(found?.first).toBeDefined();
                        expect(found?.second).toBeDefined();
                    })
                ]
            },
            {
                name: "Every Operations",
                testCases: [
                    this.createTestCase("everyAsync = true", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.everyAsync(w => w._id != "");

                        // Assert
                        expect(found).toBe(true);
                    }),
                    this.createTestCase("everyAsync = false", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.everyAsync(w => w._id === "");

                        // Assert
                        expect(found).toBe(false);
                    })
                ]
            },
            {
                name: "Some Operations",
                testCases: [
                    this.createTestCase("someAsync = true", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.someAsync(w => w._id != "");

                        // Assert
                        expect(found).toBe(true);
                    }),
                    this.createTestCase("someAsync = false", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.someAsync(w => w._id === "");

                        // Assert
                        expect(found).toBe(false);
                    }),
                    this.createTestCase("where + someAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.where(w => w._id != "").someAsync();

                        // Assert
                        expect(found).toBeDefined();
                    })
                ]
            },
            {
                name: "Count Operations",
                testCases: [
                    this.createTestCase("countAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const count = await dataStore.products.map(w => w.price).countAsync();

                        expect(all.length).toBe(count);
                    }),
                    this.createTestCase("where + countAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products);

                        // Act
                        const found = await dataStore.products.where(w => w._id != "").countAsync();

                        // Assert
                        expect(found).toBe(2);
                    }),
                    this.createTestCase("where + countAsync with no data", (factory) => async () => {
                        const dataStore = factory();
                        // Act
                        const found = await dataStore.products.where(w => w._id != "").countAsync();

                        // Assert
                        expect(found).toBe(0);
                    })
                ]
            },
            {
                name: "Max Operations",
                testCases: [
                    this.createTestCase("max", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const max = await dataStore.products.maxAsync(w => w.price);

                        all.sort((a, b) => b.price - a.price);

                        expect(max).toBe(all[0].price);
                    })
                ]
            },
            {
                name: "Min Operations",
                testCases: [
                    this.createTestCase("min", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const min = await dataStore.products.minAsync(w => w.price);

                        all.sort((a, b) => a.price - b.price);

                        expect(min).toBe(all[0].price);
                    }),
                    this.createTestCase("where + min", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const min = await dataStore.products.where(w => w.price > 100).minAsync(w => w.price);

                        const filtered = all.filter(w => w.price > 100);
                        filtered.sort((a, b) => a.price - b.price);

                        expect(min).toBe(filtered[0].price);
                    })
                ]
            },
            {
                name: "Sum Operations",
                testCases: [
                    this.createTestCase("sumAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const sum = await dataStore.products.sumAsync(w => w.price);

                        expect(all.reduce((a, v) => a + v.price, 0)).toBe(sum);
                    }),
                    this.createTestCase("where + sumAsync", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const count = await dataStore.products.where(w => w.price > 100).sumAsync(w => w.price);

                        const expectedSum = all.filter(w => w.price > 100).reduce((a, v) => a + v.price, 0);
                        expect(expectedSum).toBe(count);
                    })
                ]
            },
            {
                name: "Distinct Operations",
                testCases: [
                    this.createTestCase("distinctAsync numbers", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const result = await dataStore.products.map(w => w.price).distinctAsync();

                        const noDups = [...new Set(all.map(w => w.price))];
                        expect(result.length).toBe(noDups.length)
                        expect(noDups).toStrictEqual(result);
                    }),
                    this.createTestCase("where + distinctAsync numbers", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const result = await dataStore.products.where(w => w.price > 10).map(w => w.price).distinctAsync();

                        const noDups = [...new Set(all.filter(w => w.price > 10).map(w => w.price))];
                        expect(result.length).toBe(noDups.length)
                        expect(noDups).toStrictEqual(result);
                    }),
                    this.createTestCase("distinctAsync strings", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const result = await dataStore.products.map(w => w.name).distinctAsync();

                        const noDups = [...new Set(all.map(w => w.name))];
                        expect(result.length).toBe(noDups.length)
                        expect(noDups).toStrictEqual(result);
                    }),
                    this.createTestCase("DistinctAsync dates", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        await seedData(dataStore, () => dataStore.products, 200);

                        const all = await dataStore.products.toArrayAsync();
                        const result = await dataStore.products.map(w => w.createdDate).distinctAsync();

                        // deserializer still needs to be run on mappings
                        const noDups = [...new Set(all.map(w => w.createdDate.toISOString()))].map(w => new Date(w));
                        expect(result.length).toBe(noDups.length)
                        expect(noDups).toStrictEqual(result);
                    })
                ]
            },
            {
                name: "Attachments Operations",
                testCases: [
                    this.createTestCase("Should attach entity", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 1);
                        const secondDataStore = factory();
                        const [added] = await dataStore.products.addAsync(...generatedData);
                        await dataStore.saveChangesAsync();

                        expect(secondDataStore.products.attachments.has(added)).toBe(false);

                        secondDataStore.products.attachments.set(added);

                        expect(secondDataStore.products.attachments.has(added)).toBe(true);
                    }),
                    this.createTestCase("Should detach entity", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 1);
                        const [added] = await dataStore.products.addAsync(...generatedData);
                        await dataStore.saveChangesAsync();

                        dataStore.products.attachments.set(added);
                        expect(dataStore.products.attachments.has(added)).toBe(true);

                        dataStore.products.attachments.remove(added);
                        expect(dataStore.products.attachments.has(added)).toBe(false);
                    }),
                    this.createTestCase("Should get attached entity", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 1);
                        const [added] = await dataStore.products.addAsync(...generatedData);
                        await dataStore.saveChangesAsync();

                        dataStore.products.attachments.set(added);
                        const found = dataStore.products.attachments.get(added);

                        expect(found).toBeDefined();
                        expect(found?._id).toBe(added._id);
                    }),
                    this.createTestCase("Should filter attached entities", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 10);
                        const instances = dataStore.products.instance(...generatedData);
                        dataStore.products.attachments.set(...instances);

                        const filtered = dataStore.products.attachments.filter(w => w.price > 100);
                        expect(Array.isArray(filtered)).toBe(true);
                        expect(filtered.length).toBeGreaterThanOrEqual(0);
                    }),
                    this.createTestCase("Should find attached entity", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 10);
                        const instances = dataStore.products.instance(...generatedData);
                        dataStore.products.attachments.set(...instances);

                        const found = instances.find(w => w.price > 100)

                        const filtered = dataStore.products.attachments.find(w => w.price > 100);
                        expect(Array.isArray(filtered)).toBe(false);
                        expect(found).toEqual(filtered);
                    }),
                    this.createTestCase("Should mark entity as dirty", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 1);
                        const [added] = await dataStore.products.addAsync(...generatedData);
                        await dataStore.saveChangesAsync();

                        const instance = dataStore.products.instance(added)[0];
                        dataStore.products.attachments.set(instance);
                        dataStore.products.attachments.markDirty(instance);

                        const changeType = dataStore.products.attachments.getChangeType(instance);
                        expect(changeType).toBeDefined();
                    }),
                    this.createTestCase("Should get change type for attached entity", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 1);
                        const [added] = await dataStore.products.addAsync(...generatedData);
                        await dataStore.saveChangesAsync();

                        const instance = dataStore.products.instance(added)[0];
                        dataStore.products.attachments.set(instance);

                        const changeType = dataStore.products.attachments.getChangeType(instance);
                        expect(changeType).toBeDefined();
                    }),
                    this.createTestCase("Should return undefined for change type of unattached entity", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 1);
                        const [added] = dataStore.products.instance(...generatedData);

                        const changeType = dataStore.products.attachments.getChangeType(added);
                        expect(changeType).toBeUndefined();
                    })
                ]
            },
            {
                name: "DataStore Methods",
                testCases: [
                    this.createTestCase("Should preview changes when no changes exist", (factory) => async () => {
                        const dataStore = factory();
                        const changes = await dataStore.previewChangesAsync();
                        expect(changes.changes.adds().data.length).toBe(0);
                        expect(changes.changes.removes().data.length).toBe(0);
                        expect(changes.changes.count()).toBe(0);
                    }),
                    this.createTestCase("Should preview changes when entities are added", (factory) => async () => {
                        const dataStore = factory();
                        const generatedData = generateData(dataStore.products.schema, 2);
                        await dataStore.products.addAsync(...generatedData);

                        const changes = await dataStore.previewChangesAsync();
                        expect(changes.changes.adds().data.length).toBe(2);
                        expect(changes.changes.removes().data.length).toBe(0);
                        expect(changes.changes.updates().data.length).toBe(0);
                    }),
                    this.createTestCase("Should preview changes when entities are updated", (factory) => async () => {
                        const dataStore = factory();
                        const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
                        await dataStore.saveChangesAsync();

                        added.name = "Updated Name";
                        const changes = await dataStore.previewChangesAsync();
                        expect(changes.changes.adds().count()).toBe(0);
                        expect(changes.changes.removes().count()).toBe(0);
                        expect(changes.changes.updates().count()).toBe(1);
                    }),
                    this.createTestCase("Should preview changes when entities are removed", (factory) => async () => {
                        const dataStore = factory();
                        const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
                        await dataStore.saveChangesAsync();

                        await dataStore.products.removeAsync(added);
                        const changes = await dataStore.previewChangesAsync();
                        expect(changes.changes.adds().count()).toBe(0);
                        expect(changes.changes.removes().count()).toBe(1);
                        expect(changes.changes.updates().count()).toBe(0);
                    }),
                    this.createTestCase("Should check hasChanges when no changes exist", (factory) => async () => {
                        const dataStore = factory();
                        const hasChanges = await dataStore.hasChangesAsync();
                        expect(hasChanges).toBe(false);
                    }),
                    this.createTestCase("Should check hasChanges when entities are added", (factory) => async () => {
                        const dataStore = factory();
                        await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
                        const hasChanges = await dataStore.hasChangesAsync();
                        expect(hasChanges).toBe(true);
                    }),
                    this.createTestCase("Should check hasChanges when entities are updated", (factory) => async () => {
                        const dataStore = factory();
                        const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
                        await dataStore.saveChangesAsync();

                        added.name = "Updated Name";
                        const hasChanges = await dataStore.hasChangesAsync();
                        expect(hasChanges).toBe(true);
                    }),
                    this.createTestCase("Should check hasChanges when entities are removed", (factory) => async () => {
                        const dataStore = factory();
                        const [added] = await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
                        await dataStore.saveChangesAsync();

                        await dataStore.products.removeAsync(added);
                        const hasChanges = await dataStore.hasChangesAsync();
                        expect(hasChanges).toBe(true);
                    })
                ]
            },
            {
                name: "RemoveAll Operations",
                testCases: [
                    this.createTestCase("Should remove all entities", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 10);
                        const initialCount = await dataStore.products.countAsync();
                        expect(initialCount).toBe(10);

                        await dataStore.products.removeAllAsync();
                        const response = await dataStore.saveChangesAsync();
                        expect(response.result.removes().count()).toBe(10);

                        const finalCount = await dataStore.products.countAsync();
                        expect(finalCount).toBe(0);
                    }),
                    this.createTestCase("Should remove all entities when collection is empty", (factory) => async () => {
                        const dataStore = factory();
                        const initialCount = await dataStore.products.countAsync();
                        expect(initialCount).toBe(0);

                        await dataStore.products.removeAllAsync();
                        const response = await dataStore.saveChangesAsync();
                        expect(response.result.removes().count()).toBe(0);

                        const finalCount = await dataStore.products.countAsync();
                        expect(finalCount).toBe(0);
                    })
                ]
            },
            {
                name: "Tag Operations",
                testCases: [
                    this.createTestCase("Should tag entities for addition", (factory) => async () => {
                        const dataStore = factory();
                        const [item] = generateData(dataStore.products.schema, 1);
                        dataStore.products.tag("test-tag").add([item], () => { });
                        expect(dataStore.products).toBeDefined();
                    })
                ]
            },
            {
                name: "Instance Operations",
                testCases: [
                    this.createTestCase("Should create instances and omit id when it is identity", (factory) => async () => {
                        const dataStore = factory();
                        const [item] = generateData(dataStore.products.schema, 1);
                        const instances = dataStore.products.instance(item);
                        expect(instances.length).toBe(1);
                        expect(instances[0]._id).toBeUndefined();
                    }),
                    this.createTestCase("Should create multiple instances from raw data", (factory) => async () => {
                        const dataStore = factory();
                        const items = generateData(dataStore.products.schema, 3);
                        const instances = dataStore.products.instance(...items);
                        expect(instances.length).toBe(3);
                        instances.forEach(instance => {
                            expect(instance.category).toStrictEqual(expect.any(String));
                        });
                    })
                ]
            },
            {
                name: "Parameterized Queries",
                testCases: [
                    this.createTestCase("Should filter with parameterized query", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 100);
                        const minPrice = 100;
                        const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).toArrayAsync();
                        const all = await dataStore.products.toArrayAsync();
                        const expected = all.filter(w => w.price > minPrice);
                        expect(found.length).toBe(expected.length);
                    }),
                    this.createTestCase("Should filter with multiple parameters", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 100);
                        const params = { minPrice: 50, maxPrice: 200, category: "electronics" };
                        const found = await dataStore.products.where(([w, p]) => w.price >= p.minPrice && w.price <= p.maxPrice && w.category === p.category, params).toArrayAsync();
                        const all = await dataStore.products.toArrayAsync();
                        const expected = all.filter(w => w.price >= params.minPrice && w.price <= params.maxPrice && w.category === params.category);
                        expect(found.length).toBe(expected.length);
                    }),
                    this.createTestCase("Should use parameterized query with first", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 50);
                        const minPrice = 100;
                        const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).firstAsync();
                        expect(found.price).toBeGreaterThan(minPrice);
                    }),
                    this.createTestCase("Should use parameterized query with firstOrUndefined", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 50);
                        const minPrice = 1000;
                        const found = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).firstOrUndefinedAsync();
                        expect(found).toBeUndefined();
                    }),
                    this.createTestCase("Should use parameterized query with count", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 100);
                        const minPrice = 100;
                        const count = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).countAsync();
                        const all = await dataStore.products.toArrayAsync();
                        const expected = all.filter(w => w.price > minPrice).length;
                        expect(count).toBe(expected);
                    }),
                    this.createTestCase("Should use parameterized query with sum", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 100);
                        const minPrice = 100;
                        const sum = await dataStore.products.where(([w, p]) => w.price > p.minPrice, { minPrice }).sumAsync(w => w.price);
                        const all = await dataStore.products.toArrayAsync();
                        const expected = all.filter(w => w.price > minPrice).reduce((acc, w) => acc + w.price, 0);
                        expect(sum).toBe(expected);
                    })
                ]
            },
            {
                name: "Take and Skip Operations",
                testCases: [
                    this.createTestCase("Should take specified number of entities", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 100);
                        const found = await dataStore.products.take(10).toArrayAsync();
                        expect(found.length).toBe(10);
                    }),
                    this.createTestCase("Should skip specified number of entities", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 100);
                        const found = await dataStore.products.skip(10).toArrayAsync();
                        expect(found.length).toBe(90);
                    }),
                    this.createTestCase("Should combine where, skip, and take", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 100);
                        const found = await dataStore.products.where(w => w.price > 100).skip(5).take(10).toArrayAsync();
                        expect(found.length).toBeLessThanOrEqual(10);
                    }),
                    this.createTestCase("Should handle take with insufficient data", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 5);
                        const found = await dataStore.products.take(10).toArrayAsync();
                        expect(found.length).toBe(5);
                    }),
                    this.createTestCase("Should handle skip with insufficient data", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 5);
                        const found = await dataStore.products.skip(10).toArrayAsync();
                        expect(found.length).toBe(0);
                    })
                ]
            },
            {
                name: "Complex Queries",
                testCases: [
                    this.createTestCase("Should handle complex query with multiple operations", (factory) => async () => {
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
                    }),
                    this.createTestCase("Should handle aggregation query", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 500);
                        const totalValue = await dataStore.products
                            .where(w => w.inStock)
                            .sumAsync(w => w.price);
                        expect(totalValue).toBeGreaterThan(0);
                    }),
                    this.createTestCase("Should handle nested filtering", (factory) => async () => {
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
                    }),
                    this.createTestCase("Should handle complex sorting and mapping", (factory) => async () => {
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
                    })
                ]
            },
            {
                name: "Error Handling",
                testCases: [
                    this.createTestCase("Should handle first with no matching entities", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 10);
                        await expect(dataStore.products.where(w => w._id === "non-existent").firstAsync()).rejects.toThrow();
                    }),
                    this.createTestCase("Should handle firstOrUndefined with no matching entities", (factory) => async () => {
                        const dataStore = factory();
                        await seedData(dataStore, () => dataStore.products, 10);
                        const result = await dataStore.products.where(w => w._id === "non-existent").firstOrUndefinedAsync();
                        expect(result).toBeUndefined();
                    }),
                    this.createTestCase("Should handle min with empty collection", (factory) => async () => {
                        const dataStore = factory();
                        await expect(dataStore.products.minAsync(w => w.price)).rejects.toThrow();
                    }),
                    this.createTestCase("Should handle max with empty collection", (factory) => async () => {
                        const dataStore = factory();
                        await expect(dataStore.products.maxAsync(w => w.price)).rejects.toThrow();
                    }),
                    this.createTestCase("Should handle sum with empty collection", (factory) => async () => {
                        const dataStore = factory();
                        const result = await dataStore.products.sumAsync(w => w.price);
                        expect(result).toBe(0);
                    }),
                    this.createTestCase("Should handle count with empty collection", (factory) => async () => {
                        const dataStore = factory();
                        const result = await dataStore.products.countAsync();
                        expect(result).toBe(0);
                    })
                ]
            },
            {
                name: "Subscription Management",
                testCases: [
                    this.createTestCase("Should not fire callbacks after unsubscribe", (factory) => async () => {
                        const dataStore = factory();
                        const callback = this.testingOptions.fn();
                        await seedData(dataStore, () => dataStore.products);

                        const unsubscribe = dataStore.products.subscribe().where(w => w._id != "").firstOrUndefined(callback);

                        await wait(500);

                        unsubscribe();

                        await dataStore.products.addAsync(...generateData(dataStore.products.schema, 1));
                        await dataStore.saveChangesAsync();
                        await wait(500);

                        expect(callback).toHaveBeenCalledTimes(1);
                    })
                ]
            }
        ];
    }
}