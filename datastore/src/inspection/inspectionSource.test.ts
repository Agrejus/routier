import { afterEach, describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import type { DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import type { PluginEventCallbackResult } from "@routier/core/results";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DataStore } from "../DataStore";
import { INSPECTION_SOURCE } from "../index";

const itemSchema = s.define("sourceItems", {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

class RecordingPlugin extends MemoryPlugin {
    readonly sources: string[] = [];

    override query<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.sources.push(event.source);
        super.query(event, done);
    }
}

class ItemStore extends DataStore {
    items = this.collection(itemSchema).proxy().create();
}

const stores: DataStore[] = [];
let storeId = 0;

afterEach(() => {
    for (const store of stores.splice(0)) store[Symbol.dispose]();
});

function createStore() {
    storeId++;
    const plugin = new RecordingPlugin(`inspection-source-${storeId}`);
    const store = new ItemStore(plugin);
    stores.push(store);
    return { store, plugin, items: store.inspect().collections[0] };
}

async function eventually(assertion: () => void): Promise<void> {
    const deadline = Date.now() + 2000;
    for (;;) {
        try {
            assertion();
            return;
        } catch (error) {
            if (Date.now() > deadline) throw error;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

describe("inspection query source", () => {
    it("is exported for tools that filter devtools traffic", () => {
        expect(INSPECTION_SOURCE).toBe("Inspection");
    });

    it("labels count() queries", async () => {
        const { plugin, items } = createStore();

        await items.count();

        expect(plugin.sources).toEqual([INSPECTION_SOURCE]);
    });

    it("labels watchCount() queries, including the re-query after a save", async () => {
        const { store, plugin, items } = createStore();
        const counts: number[] = [];
        const stop = items.watchCount(result => {
            if (result.status === "success") counts.push(result.count);
        });
        await eventually(() => expect(counts).toEqual([0]));
        plugin.sources.length = 0;

        await store.items.addAsync({ name: "one" });
        await store.saveChangesAsync();
        await eventually(() => expect(counts).toEqual([0, 1]));
        stop();

        expect(plugin.sources).toEqual([INSPECTION_SOURCE]);
    });

    it("labels watchPage() queries", async () => {
        const { plugin, items } = createStore();
        let delivered = false;

        const stop = items.watchPage({ skip: 0, take: 50 }, () => {
            delivered = true;
        });
        await eventually(() => expect(delivered).toBe(true));
        stop();

        expect(plugin.sources).toEqual([INSPECTION_SOURCE]);
    });

    it("leaves the app's own queries labelled as collection queries", async () => {
        const { store, plugin } = createStore();

        await store.items.toArrayAsync();
        await store.items.countAsync();

        expect(plugin.sources).toEqual(["Collection", "Collection"]);
    });

    it("keeps the label through explain()", async () => {
        const { store, plugin } = createStore();

        await store.items.explain().toArrayAsync();

        expect(plugin.sources).toEqual(["Collection"]);
    });
});
