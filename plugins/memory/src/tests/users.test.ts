import { faker } from '@faker-js/faker';
import { describe, it, expect, afterAll } from '@jest/globals';
import { IDbPlugin, InferType, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';
import { userSchema } from './schemas/user';

const generateDbName = () => `${uuidv4()}-db`;
const pluginFactory: (dbname?: string) => IDbPlugin = (dbname?: string) => new MemoryPlugin(dbname ?? generateDbName());
const stores: TestDataStore[] = [];
const factory = (dbname?: string) => {

    const store = new TestDataStore(pluginFactory(dbname));

    stores.push(store);

    return store;
};

describe("User Tests", () => {

    afterAll(async () => {
        await Promise.all(stores.map(x => x.destroyAsync()));
    });

    describe('Add Operations', () => {
        it("Can add item with default date and default id", async () => {
            const dataStore = factory();

            const [added] = await dataStore.users.addAsync({
                userRef: faker.string.uuid(),
                createdAt: new Date("01/01/1900 8:00 AM").getTime(),
                metadataJson: {
                    firstName: faker.person.firstName(),
                    lastName: faker.person.lastName(),
                    email: faker.internet.email(),
                },
            });

            const response = await dataStore.saveChangesAsync();

            expect(added.id).toBeDefined();
            expect(added.createdDate).toEqual(new Date("01/01/1900 8:00 AM"));
            expect(response.aggregate.size).toBe(1);
        });

        it("Can query data", async () => {
            const dataStore = factory();

            const users = Array.from({ length: 1000 }, () => ({
                userRef: faker.string.uuid(),
                createdAt: faker.date.past().getTime(),
                metadataJson: {
                    firstName: faker.person.firstName(),
                    lastName: faker.person.lastName(),
                    email: faker.internet.email(),
                },
            }));

            const added = await dataStore.users.addAsync(...users);
            const userRef = faker.string.uuid();
            await dataStore.users.addAsync({
                userRef,
                createdAt: new Date("01/01/1900 8:00 AM").getTime(),
                metadataJson: {
                    firstName: "James",
                    lastName: faker.person.lastName(),
                    email: faker.internet.email(),
                },
            });

            const response = await dataStore.saveChangesAsync();

            expect(added.length).toBe(1000);

            const user = await new Promise<InferType<typeof userSchema> | undefined>((resolve) => {
                dataStore.users.subscribe().where(([u, p]) => u.userRef === p.sub, { sub: userRef }).firstOrUndefined(r => {
                    resolve(r.ok === "success" ? r.data : undefined);
                });
            });
            expect(user?.userRef).toBe(userRef);
            expect(added.every(user => user.id !== undefined)).toBe(true);
            expect(response.aggregate.size).toBe(1001);
        });
    });
});