import { describe, it, beforeEach } from '@jest/globals';
import { DataStore, SyncDataStore } from '.';
import { CompiledSchema, s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { generateData } from '@routier/test-utils';
import { CallbackResult, Result, SchemaPersistResult } from '@routier/core';

const simple = s.define("simple", {
    id: s.number().key(),
    name: s.string(),
}).compile();

class ServerDataStore extends DataStore {
    simple = this.collection(simple).create();
}

const serverDataStore = new ServerDataStore(new MemoryPlugin("server"));

const setup = async () => {
    const data = generateData(serverDataStore.simple.schema, 1000);

    await serverDataStore.simple.addAsync(...data);
    await serverDataStore.saveChangesAsync();
}

class TestDataStore extends SyncDataStore {

    simple = this.collection(simple).create();

    fetchRemoteData<T extends {}>(_: CompiledSchema<T>, sinceTimestamp: number | null, done: CallbackResult<{ data: T[], serverTimestamp: number }>) {
        serverDataStore.simple.toArray((response) => {

            if (response.ok !== Result.SUCCESS) {
                return done(response as any);
            }

            return done(Result.success({
                data: response.data as any,
                serverTimestamp: Date.now()
            }))
        });
    }

    handleIncomingData<T extends {}>(_: CompiledSchema<T>, done: CallbackResult<T[]>) {

    }

    sendChangesToRemote<T extends {}>(_: CompiledSchema<T>, data: SchemaPersistResult<T>, done: CallbackResult<{ serverTimestamp: number }>) {
        let pendingOps = 0;
        let hasError = false;

        if (data.adds.length > 0) {
            pendingOps++;
            serverDataStore.simple.add(data.adds as any, (result) => {
                if (result.ok === Result.ERROR) {
                    hasError = true;
                }
                pendingOps--;
                if (pendingOps === 0) {
                    done(hasError ? Result.error("Sync failed") : Result.success({ serverTimestamp: Date.now() }));
                }
            });
        }

        if (data.updates.length > 0) {
            pendingOps++;
            const updateEntities = data.updates.map((u: any) => u.entity || u);
            serverDataStore.simple.attachments.set(...updateEntities as any);
            serverDataStore.simple.attachments.markDirty(...updateEntities as any);
            serverDataStore.saveChanges((result) => {
                if (result.ok === Result.ERROR) {
                    hasError = true;
                }
                pendingOps--;
                if (pendingOps === 0) {
                    done(hasError ? Result.error("Sync failed") : Result.success({ serverTimestamp: Date.now() }));
                }
            });
        }

        if (data.removes.length > 0) {
            pendingOps++;
            serverDataStore.simple.remove(data.removes as any, (result) => {
                if (result.ok === Result.ERROR) {
                    hasError = true;
                }
                pendingOps--;
                if (pendingOps === 0) {
                    done(hasError ? Result.error("Sync failed") : Result.success({ serverTimestamp: Date.now() }));
                }
            });
        }

        if (pendingOps === 0) {
            done(Result.success({ serverTimestamp: Date.now() }));
        }
    }

    destroyRemoteResources(done: CallbackResult<never>) {
        done(Result.success(undefined as never));
    }
}

const dataStoreFactory = () => {
    return new TestDataStore(new MemoryPlugin("client"), {
        serverBaseUrl: 'http://localhost:3000',
        clientId: 'test-client'
    });
}

describe('Sync Data Store', () => {

    describe("Sync", () => {

        it('should sync', async () => {

            await setup();

            const store = dataStoreFactory();
            await store.syncAsync();
            const count = await store.simple.countAsync()

            expect(count).toBe(1000);

        });
    });
}); 