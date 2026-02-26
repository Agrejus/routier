import { describe, it, expect } from '@jest/globals';
import { DataStore } from '.';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import { BulkPersistResult } from '@routier/core/collections';
import { s } from '@routier/core/schema';
import { logger, PluginEventCallbackPartialResult, PluginEventCallbackResult, uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';

// Options

// Option 1 -> Classes
// toJson is needed because we do not have class properties, only getters and setters
// However, this would allow for immutable objects

class Entity {

    
    get name() {
        return "";
    }

    set name(value:string) {

    }

    toJson() {

    }
}

// Option 2
// const [ entity, setter] = await this.store.firstAsync();
// const [[one, oneSetter], [two, twoSetter]] = await this.store.toArrayAsync();

// Option 3
// use a mutate function to change any object
// const { mutate } = this.store;
// mutate(entity, {
//   name: "James"
// })



const simple = s.define("simple", {
    id: s.number().key(),
    name: s.string(),
}).compile();

type GenericPluginOptions = {
    onQuery?: <TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>) => void,
    onDestroy?: (event: DbPluginEvent) => void,
    onBulkPersist?: (event: DbPluginBulkPersistEvent) => void
}
class GenericPlugin extends MemoryPlugin {

    private options?: GenericPluginOptions;

    constructor(options?: GenericPluginOptions) {
        super(uuidv4());
        this.options = options;
    }

    query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.options?.onQuery?.(event);
        super.query(event, done);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.options?.onDestroy?.(event);
        super.destroy(event, done);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.options?.onBulkPersist?.(event);
        super.bulkPersist(event, done);
    }
}

class GenericDataStore extends DataStore {

    simple = this.collection(simple).create();
}

const genericFactory = (options?: GenericPluginOptions) => {
    return new GenericDataStore(new GenericPlugin(options));
}

describe('Data Store', () => {

    describe("Tags", () => {

        it('should tag added entity', async () => {

            logger.log("test");

            let resolve!: () => void;
            const called = new Promise<void>(r => { resolve = r; });

            const onBulkPersist = (event: DbPluginBulkPersistEvent) => {

                for (const [, changes] of event.operation) {
                    expect(changes.tags.size).toBe(1);

                    for (const [entity, tag] of changes.tags) {
                        expect((entity as any).id).toBe(1);
                        expect(tag).toBe("test");
                    }
                }
                resolve();
            };

            const store = genericFactory({ onBulkPersist });
            await store.simple.tag('test').addAsync({ id: 1, name: 'name' });
            await store.saveChangesAsync();

            await called; // waits until callback ran
        });

        it('should tag added entities', async () => {

            let resolve!: () => void;
            const called = new Promise<void>(r => { resolve = r; });

            const onBulkPersist = (event: DbPluginBulkPersistEvent) => {

                for (const [, changes] of event.operation) {
                    expect(changes.tags.size).toBe(3);

                    let count = 0;
                    for (const [entity, tag] of changes.tags) {
                        count++;
                        expect((entity as any).id).toBe(count);
                        expect(tag).toBe("test");
                    }
                }
                resolve();
            };

            const store = genericFactory({ onBulkPersist });
            await store.simple.tag('test').addAsync(
                { id: 1, name: 'name 1' },
                { id: 2, name: 'name 2' },
                { id: 3, name: 'name 3' }
            );
            await store.saveChangesAsync();

            await called; // waits until callback ran
        });

        it('should tag update', async () => {

            let resolve!: () => void;
            const called = new Promise<void>(r => { resolve = r; });
            let count = 0;

            const onBulkPersist = (event: DbPluginBulkPersistEvent) => {

                for (const [, changes] of event.operation) {
                    count++;

                    if (count === 2) {
                        expect(changes.tags.size).toBe(1);
                    }
                }
                resolve();
            };

            const store = genericFactory({ onBulkPersist });
            await store.simple.addAsync({ id: 1, name: 'name' });
            await store.saveChangesAsync();

            let query = store.simple.toQueryable();

            query = query.where(x => x.id == 1);
            query = query.take(1);
            query = query.skip(1);

            query = query.sort(x => x.id);

            const found = await store.simple.tag("test").firstAsync();

            found.name = "updated";

            await store.saveChangesAsync();

            await called; // waits until callback ran
        });
    });
}); 