import { IDbPlugin, uuidv4 } from "routier-core";
import { BasicRoutier } from "./BasicRoutier";
import { MemoryPlugin } from 'routier-plugin-memory';
import { PouchDbPlugin } from 'routier-plugin-pouchdb';
import { DexiePlugin } from 'routier-plugin-dexie';

type PluginCreator = () => IDbPlugin;

export class BasicContextFactory {

    private creators: PluginCreator[] = [];
    private routiers: BasicRoutier[] = [];

    private constructor(...pluginCreators: PluginCreator[]) {
        for (const creator of pluginCreators) {
            this.creators.push(creator);
        }
    }

    createRoutiers() {
        const result: BasicRoutier[] = [];

        for (const creator of this.creators) {
            const routier = new BasicRoutier(creator());
            result.push(routier);
            this.routiers.push(routier);
        }

        return result
    }

    static create() {
        return new BasicContextFactory(
            () => new PouchDbPlugin(uuidv4()),
            () => new MemoryPlugin(uuidv4()),
            () => new DexiePlugin(uuidv4())
        );
    }

    async cleanup() {
        await Promise.all(this.routiers.map(async x => x.destroyAsync()));
    }
}