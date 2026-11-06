import { DataStore } from "@routier/datastore";
import type { IDbPlugin } from "@routier/core";
import { todos } from "../todos";

const summarize = (items: readonly { name: string; done: boolean; label: string; upper: string; meta: { owner: string }; tags: string[] }[]) =>
    items
        .map(({ name, done, label, upper, meta, tags }) => ({ name, done, label, upper, meta, tags }))
        .sort((a, b) => a.name.localeCompare(b.name));

const runDataStore = async (plugin: IDbPlugin) => {
    class Store extends DataStore {
        todos = this.collection(todos).proxy().create();

        constructor() {
            super(plugin);
        }
    }

    const store = new Store();

    await store.todos.addAsync(
        { name: "write", meta: { owner: "a" }, tags: ["x"] },
        { name: "test", meta: { owner: "b" }, tags: [] },
        { name: "ship", meta: { owner: "c" }, tags: ["y", "z"] },
    );
    await store.saveChangesAsync();

    const added = summarize(await store.todos.toArrayAsync());
    const found = await store.todos.firstAsync(x => x.name === "test");

    found.done = true;
    await store.saveChangesAsync();

    const edited = summarize(await store.todos.toArrayAsync());
    const removed = await store.todos.firstAsync(x => x.name === "ship");

    await store.todos.removeAsync(removed);
    await store.saveChangesAsync();

    const remaining = summarize(await store.todos.toArrayAsync());

    return { added, edited, remaining };
};

const runSchema = () => {
    const entity = todos.enrich({ id: "a", name: "x", done: false, label: "todo-label", upper: "", meta: { owner: "o" }, tags: ["t"] }, "diff");

    return {
        entity,
        clone: todos.clone(entity),
        storageClone: todos.cloneStorage(entity),
        prepared: todos.prepare(entity),
        serialized: todos.serialize(entity),
        id: todos.getId(entity),
        equal: todos.compare(entity, todos.clone(entity)),
    };
};

const publish = (result: object): void => {
    Reflect.set(window, "__result", result);
};

export const run = async (plugin: IDbPlugin): Promise<void> => {
    try {
        publish({ ok: true, schema: runSchema(), store: await runDataStore(plugin) });
    } catch (error) {
        publish({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
};
