import { describe, expect, it } from '@jest/globals';
import { CodeBuilder, SlotBlock } from './blocks';

describe("codegen blocks", () => {
    it("can build and retrieve nested slot paths", () => {
        const root = new CodeBuilder();
        root.slot("factory").slot("function").slot("ifs");

        const slot = root.get<SlotBlock>("factory.function.ifs");
        slot.insert("x = 1;");

        expect(root.toString()).toContain("x = 1;");
    });

    it("throws for missing get() path", () => {
        const root = new CodeBuilder();
        expect(() => root.get("missing.path")).toThrow("Error finding code block for given path");
    });

    it("assignment builder throws when no value was set", () => {
        const root = new CodeBuilder();
        root.assign("const x");

        expect(() => root.toString()).toThrow("Value cannot be null for AssignmentBuilder Builder");
    });
});

describe("binding values into generated code", () => {
    it("CodeBuilder.bind returns distinct names and records each value", () => {
        const root = new CodeBuilder();
        const first = () => 1;
        const second = { a: 1 };

        const firstName = root.bind(first);
        const secondName = root.bind(second);
        const namedName = root.bind("x", "named");

        expect(new Set([firstName, secondName, namedName]).size).toBe(3);
        expect(namedName).toBe("named");
        expect(root.getBindings()).toEqual([
            { name: firstName, value: first },
            { name: secondName, value: second },
            { name: "named", value: "x" },
        ]);
    });

    it("CodeBuilder.bind records a value bound twice under one name only once", () => {
        const root = new CodeBuilder();
        const helper = () => 1;

        expect(root.bind(helper, "helper")).toBe("helper");
        expect(root.bind(helper, "helper")).toBe("helper");
        expect(root.getBindings()).toEqual([{ name: "helper", value: helper }]);
    });

    it("CodeBuilder.bind keeps one value bound under two names", () => {
        const root = new CodeBuilder();
        const helper = () => 1;

        root.bind(helper, "first");
        root.bind(helper, "second");

        expect(root.getBindings()).toEqual([{ name: "first", value: helper }, { name: "second", value: helper }]);
    });

    it("CodeBuilder.bind keeps a different value bound under a name already in use", () => {
        const root = new CodeBuilder();

        root.bind("first", "shared");
        root.bind("second", "shared");

        expect(root.getBindings()).toEqual([{ name: "shared", value: "first" }, { name: "shared", value: "second" }]);
    });

    it("FunctionFactoryBuilder.bind adds a factory parameter carrying the value", () => {
        const root = new CodeBuilder();
        const factory = root.factory("factory", { name: "factory" }).parameters({ name: "collectionName", value: "c" });
        const fn = function (value: number) { return value * 2; };

        const name = factory.bind(fn);
        factory.appendBody(`return ${name}(21);`);

        const parameters = factory.getParameters();
        expect(parameters).toEqual([{ name: "collectionName", value: "c" }, { name, value: fn }]);

        // Compiled the way SchemaDefinition compiles its factories
        const compiled = Function(`return ${root.toString()}`)();
        expect(compiled(...parameters.map(w => w.value))).toBe(42);
    });
});
