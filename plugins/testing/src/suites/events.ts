import { TestSuiteBase } from './base';
import { generateData } from '../utils/dataGenerator';

export class EventsTestSuite extends TestSuiteBase {

    override getTestSuites() {
        const expect = this.testingOptions.expect;

        return [
            {
                name: "Add Operations",
                testCases: [
                    this.createTestCase("Can add item with default date", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        const [item] = generateData(dataStore.events.schema, 1);

                        // Act
                        const [added] = await dataStore.events.addAsync(item);
                        const response = await dataStore.saveChangesAsync();

                        // Assert
                        expect(response.aggregate.size).toBe(1);
                        expect(added.endTime?.toISOString()).toBe(item.endTime?.toISOString());
                    }),
                    this.createTestCase("Can add item with default static value", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        const [item] = generateData(dataStore.events.schema, 1);

                        // Act
                        const [added] = await dataStore.events.addAsync(item);
                        const response = await dataStore.saveChangesAsync();
                        // Assert
                        expect(response.aggregate.size).toBe(1);
                        expect(added.name).toBe(item.name);
                        expect(added.name).toBe("James");
                    })
                ]
            }, {
                name: "Subscription Management",
                testCases: [
                    this.createTestCase("Should return unsubscribe function", (factory) => async () => {
                        const dataStore = factory();
                        await dataStore.events.firstOrUndefinedAsync(w => w._id != "")
                        const unsubscribe = dataStore.products.subscribe().where(w => w._id != null).firstOrUndefined(() => { });
                        expect(typeof unsubscribe).toBe('function');
                        unsubscribe();
                    })
                ]
            }
        ];
    }
}