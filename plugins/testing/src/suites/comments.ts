import { generateData } from '../utils/dataGenerator';
import { describe, it, expect } from 'vitest';
import { TestDataStore } from '../context';
import { IDbPlugin } from 'routier-core';

const pluginFactory: () => IDbPlugin = () => null as any; // Replace with your plugin
const factory = () => new TestDataStore(pluginFactory());

describe("Comments Tests", () => {

    describe('Add Operations', () => {
        it("Can add item with default", async () => {
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
        });
    });

});