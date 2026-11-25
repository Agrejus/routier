import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { byCollection, clientWins, fieldMerge, HttpSwrDbPlugin } from "@routier/replication-plugin";
import { etags, s } from "@routier/core/schema";

const todoSchema = s.define("todos", {
    id: s.string().key().identity(),
    title: s.string(),
    done: s.boolean(),
    version: s.number().etag(etags.numeric).optional(),
}).compile();

const sync = new HttpSwrDbPlugin(new MemoryPlugin("todos-cache"), {
    getUrl: (collectionName) => `https://api.example.com/${collectionName}`,
    unsyncedQueueStore: new MemoryPlugin("todos-queue"),
    resolveConflict: byCollection({
        todos: fieldMerge({
            onBoth: (field, values) => field === "done" ? values.local : values.remote,
        }),
        drafts: clientWins(),
    }),
    onEvent: (event) => {
        if (event.type === "conflict-resolved") {
            console.log(`${event.collectionName}: ${event.outcome}`);
        }
    },
});

class AppDataStore extends DataStore {
    todos = this.collection(todoSchema).proxy().create();

    constructor() {
        super(sync);
    }
}

const store = new AppDataStore();
