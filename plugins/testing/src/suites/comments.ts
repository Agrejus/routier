import { TestSuiteBase } from './base';
import { generateData } from '../utils/dataGenerator';

export class CommentsTestSuite extends TestSuiteBase {

    override getTestSuites() {
        const expect = this.testingOptions.expect;

        return [
            {
                name: "Add Operations",
                testCases: [
                    this.createTestCase("Can add item with default", (factory) => async () => {
                        const dataStore = factory();
                        // Arrange
                        const [item] = generateData(dataStore.comments.schema, 1);

                        // Act
                        const [added] = await dataStore.comments.addAsync(item);
                        const response = await dataStore.saveChangesAsync();

                        // Assert
                        expect(response.aggregate.size).toBe(1);
                        expect(added._id).toStrictEqual(expect.any(String));
                        expect(added.author).toStrictEqual(item.author);
                        expect(added.content).toBe(item.content);
                        expect(added.replies).toStrictEqual(item.replies);
                        expect(added.createdAt).toBe(item.createdAt);
                        expect(added.createdAt).toBeDefined()
                    })
                ]
            }
        ];
    }
}