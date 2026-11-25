import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { uuidv4 } from "@routier/core";
import { s } from "@routier/core/schema";
import { resetLogLevel, setLogLevel } from "@routier/core/utilities";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DataStore } from "../DataStore";
import { inspect } from "node:util";

const personSchema = s.define("sensitive_people", {
    id: s.string().key(),
    name: s.string(),
    ssn: s.string().sensitive(),
    pin: s.number().sensitive(),
}).compile();

class Store extends DataStore {
    people = this.collection(personSchema).proxy().create();
}

const stores: Store[] = [];

const seeded = async () => {
    const store = new Store(new MemoryPlugin(`sensitive-${uuidv4()}`));

    stores.push(store);
    await store.people.addAsync({ id: "p1", name: "Ada", ssn: "123-45-6789", pin: 4321 });
    await store.saveChangesAsync();

    return store;
};

let logged: string[] = [];

beforeEach(() => {
    logged = [];

    for (const method of ["debug", "info", "warn", "error", "log"] as const) {
        jest.spyOn(console, method).mockImplementation((...args) => {
            logged.push(args.map(arg => typeof arg === "string" ? arg : inspect(arg, { depth: 20 })).join(" "));
        });
    }

    setLogLevel("debug");
});

afterEach(() => {
    jest.restoreAllMocks();
    resetLogLevel();

    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

describe("a sensitive property", () => {
    it("is hidden in the explanation of a filter on it", async () => {
        const store = await seeded();
        const { data, explanation } = await store.people.where(p => p.ssn === "123-45-6789").explain().toArrayAsync();

        expect(data.map(row => row.id)).toEqual(["p1"]);
        expect(JSON.stringify(explanation)).not.toContain("123-45-6789");
        expect(JSON.stringify(explanation)).toContain("[redacted]");
    });

    it("leaves a filter on another property readable", async () => {
        const store = await seeded();
        const { explanation } = await store.people.where(p => p.name === "Ada").explain().toArrayAsync();

        expect(JSON.stringify(explanation)).toContain("Ada");
    });

    it("is hidden in the warning about a comparison that can never match", async () => {
        const store = await seeded();
        const wrongType: string = "987654";

        await store.people.where(([p, params]) => p.pin === (params.pin as never), { pin: wrongType }).toArrayAsync();
        await store.people.where(p => p.pin === ("987654" as never)).toArrayAsync();

        expect(logged.join("\n")).not.toContain("987654");
    });

    it("hides filter parameters when a filter on its collection cannot be parsed", async () => {
        const store = await seeded();
        const unparsable = (value: string) => value.split("").reverse().join("");

        await store.people.where(([p, params]) => unparsable(p.ssn) === params.reversed, { reversed: "9876-54-321" }).toArrayAsync();

        expect(logged.join("\n")).not.toContain("9876-54-321");
    });
});
