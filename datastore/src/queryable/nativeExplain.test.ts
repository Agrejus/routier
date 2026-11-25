import { afterEach, describe, expect, it } from "@jest/globals";
import { uuidv4 } from "@routier/core";
import { CacheDbPlugin, executedQueriesOf, formatExplanation } from "@routier/core/plugins";
import { s } from "@routier/core/schema";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DataStore } from "../DataStore";

const personSchema = s.define("native_people", {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
}).compile();

const dashedSchema = s.define("native-dashed", {
    id: s.string().key(),
}).compile();

class Store extends DataStore {
    people = this.collection(personSchema).proxy().create();
    dashed = this.collection(dashedSchema).proxy().create();
}

const stores: Store[] = [];

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const seeded = async (wrap: (plugin: MemoryPlugin) => MemoryPlugin | CacheDbPlugin = plugin => plugin) => {
    const store = new Store(wrap(new MemoryPlugin(`native-${uuidv4()}`)));

    stores.push(store);
    await store.people.addAsync({ id: "a", name: "Ada", age: 36 }, { id: "b", name: "Bo", age: 20 }, { id: "c", name: "Cy", age: 41 });
    await store.saveChangesAsync();

    return store;
};

describe("the memory plugin's executed query", () => {
    it("is a JavaScript filter over the collection, with the values as parameters", async () => {
        const { explanation } = await (await seeded()).people.where(p => p.age > 30 && p.name !== "Cy").explain().toArrayAsync();

        expect(executedQueriesOf(explanation)).toEqual([{
            text: "native_people.filter(x => (x.age > ? && x.name !== ?))",
            parameters: [30, "Cy"],
            language: "javascript",
            note: "returned 1 in-memory record",
        }]);
    });

    it("is the collection itself when there is no filter", async () => {
        const { explanation } = await (await seeded()).people.explain().toArrayAsync();

        expect(executedQueriesOf(explanation)).toEqual([{ text: "native_people", language: "javascript", note: "returned 3 in-memory records" }]);
    });

    it("names a collection that is not an identifier by its string", async () => {
        const { explanation } = await (await seeded()).dashed.explain().toArrayAsync();

        expect(executedQueriesOf(explanation)[0].text).toBe('collections["native-dashed"]');
    });

    it("is printed with its note as a comment", async () => {
        const { explanation } = await (await seeded()).people.where(p => p.age > 30).explain().toArrayAsync();
        const formatted = formatExplanation(explanation);

        expect(formatted).toContain("// returned 2 in-memory records");
        expect(formatted).toContain("native_people.filter(x => x.age > ?)");
    });
});

describe("a cache hit", () => {
    it("is reported as a note with no query", async () => {
        const store = await seeded(plugin => new CacheDbPlugin(plugin));

        await store.people.where(p => p.age > 30).toArrayAsync();
        const { explanation } = await store.people.where(p => p.age > 30).explain().toArrayAsync();

        expect(executedQueriesOf(explanation)).toEqual([{ text: "", note: "cache hit: no query ran" }]);
        expect(formatExplanation(explanation)).toContain("// cache hit: no query ran");
    });
});
