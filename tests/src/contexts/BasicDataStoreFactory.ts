import { IDbPlugin, uuidv4 } from "routier-core";
import { BasicDataStore } from "./BasicDataStore";
import { MemoryPlugin } from 'routier-plugin-memory';
import { PouchDbPlugin } from 'routier-plugin-pouchdb';

type PluginCreator = () => IDbPlugin;

export class BasicDataStoreFactory {

    private creators: PluginCreator[] = [];
    private routiers: BasicDataStore[] = [];

    private constructor(...pluginCreators: PluginCreator[]) {
        for (const creator of pluginCreators) {
            this.creators.push(creator);
        }
    }

    createDataStores() {
        const result: BasicDataStore[] = [];

        for (const creator of this.creators) {
            const routier = new BasicDataStore(creator());
            result.push(routier);
            this.routiers.push(routier);
        }

        return result
    }

    createDataStore(test: (dataStore: BasicDataStore) => Promise<void>) {
        const dataStore = new BasicDataStore(new MemoryPlugin(uuidv4()));

        return () => test(dataStore).then(() => dataStore.destroyAsync());
    }

    static create() {
        return new BasicDataStoreFactory(
            //() => new PouchDbPlugin(uuidv4()),
            () => new MemoryPlugin(uuidv4()),
            //() => new DexiePlugin(uuidv4())
        );
    }

    async cleanup() {
        await Promise.all(this.routiers.map(async x => x.destroyAsync()));
    }
}