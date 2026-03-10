import { describe, expect, it } from '@jest/globals';
import { CodeBuilder, SlotBlock } from './blocks';
import { PropertyInfoHandler } from './handlers/types';

class TestPropertyInfoHandler extends PropertyInfoHandler {
    parseFunction(source: string, parent: SlotBlock) {
        return this.toNamedFunction(source, parent);
    }
}

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

describe("PropertyInfoHandler.toNamedFunction", () => {
    it("parses single-arrow implicit return", () => {
        const handler = new TestPropertyInfoHandler();
        const parent = new CodeBuilder().slot("declarations");
        const parsed = handler.parseFunction("(x) => x + 1", parent);

        expect(parsed.parameters).toEqual(["x"]);
        expect(parsed.builder.toString()).toContain("return x + 1;");
    });

    it("parses arrow function with block body", () => {
        const handler = new TestPropertyInfoHandler();
        const parent = new CodeBuilder().slot("declarations");
        const parsed = handler.parseFunction("(x) => { const y = x + 1; return y; }", parent);

        expect(parsed.parameters).toEqual(["x"]);
        expect(parsed.builder.toString()).toContain("const y = x + 1;");
        expect(parsed.builder.toString()).toContain("return y;");
    });

    it("throws when source is not an arrow function", () => {
        const handler = new TestPropertyInfoHandler();
        const parent = new CodeBuilder().slot("declarations");

        expect(() => handler.parseFunction("function (x) { return x; }", parent)).toThrow(
            "Only arrow functions are allowed in the schema definition"
        );
    });
});
