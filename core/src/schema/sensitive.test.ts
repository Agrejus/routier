import { describe, expect, it } from "@jest/globals";
import { s } from "./builder";
import { compiledSchemaToJsonSchema, rehydrateSchemaFromJsonSchema } from "./utils/standardJsonSchema";
import { redactEntity } from "./utils/redactEntity";
import { REDACTED } from "../expressions/redact";

const people = () => s.define("people", {
    id: s.string().key(),
    name: s.string(),
    ssn: s.string().sensitive(),
    phone: s.string().optional().sensitive(),
    pin: s.number().sensitive().nullable(),
    born: s.date().sensitive().default(() => new Date(0)),
    verified: s.boolean().sensitive(),
    tags: s.string().array().sensitive(),
    card: s.object({ number: s.string(), brand: s.string() }).sensitive().optional(),
    address: s.object({ street: s.string().sensitive(), city: s.string() }),
}).compile();

const sensitiveOf = (schema: ReturnType<typeof people>) =>
    schema.properties.filter(property => property.isSensitive).map(property => property.id);

describe(".sensitive()", () => {
    it("marks each property it is declared on, before or after another modifier", () => {
        expect(sensitiveOf(people())).toEqual(expect.arrayContaining(["ssn", "phone", "pin", "born", "verified", "tags", "card", "address.street"]));
    });

    it("leaves other properties alone", () => {
        const schema = people();

        expect(schema.properties.filter(property => ["id", "name", "address", "address.city"].includes(property.id)).some(property => property.isSensitive)).toBe(false);
    });

    it("marks the properties inside a sensitive object", () => {
        expect(sensitiveOf(people())).toEqual(expect.arrayContaining(["card.number", "card.brand"]));
    });

    it("keeps the modifiers declared around it", () => {
        const property = (id: string) => people().properties.find(candidate => candidate.id === id);

        expect(property("phone")?.isOptional).toBe(true);
        expect(property("pin")?.isNullable).toBe(true);
        expect(property("card")?.isOptional).toBe(true);
    });

    it("lists the sensitive properties on the schema", () => {
        const schema = people();

        expect(schema.sensitiveProperties.map(property => property.id).sort()).toEqual(sensitiveOf(schema).sort());
    });

    it("chains on to the other modifiers", () => {
        const schema = s.define("chained", {
            id: s.string().key(),
            a: s.string().sensitive().tag("t").from("a_column"),
            b: s.string().sensitive().readonly(),
            c: s.string().sensitive().index("c"),
            d: s.string().sensitive().distinct(),
            e: s.string().sensitive().optional(),
            f: s.string().sensitive().nullable(),
            g: s.string().sensitive().deserialize(value => String(value)),
        }).compile();

        expect(schema.sensitiveProperties.map(property => property.id).sort()).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    });

    it("is marked by a transform that declares it", () => {
        const schema = s.define("encrypted", {
            id: s.string().key(),
            secret: s.string(),
            plain: s.string(),
        }).modify(x => ({
            secret: x.transform({ to: value => value, from: value => String(value), sensitive: true }),
            plain: x.transform({ to: value => value, from: value => String(value) }),
        })).compile();

        expect(schema.sensitiveProperties.map(property => property.id)).toEqual(["secret"]);
    });

    it("survives a JSON Schema round trip", () => {
        const json = compiledSchemaToJsonSchema(people(), "draft-2020-12", false);
        const rebuilt = rehydrateSchemaFromJsonSchema(JSON.parse(JSON.stringify(json)), "people").compile();

        expect(rebuilt.properties.find(property => property.id === "ssn")?.isSensitive).toBe(true);
        expect(rebuilt.properties.find(property => property.id === "name")?.isSensitive).toBe(false);
    });
});

describe("redactEntity", () => {
    const row: { id: string; name: string; ssn: string; pin: number | null; address: { street: string; city: string } } = {
        id: "p1",
        name: "Ada",
        ssn: "123-45-6789",
        pin: null,
        address: { street: "1 Main St", city: "London" },
    };

    it("hides each sensitive value, nested ones included", () => {
        expect(redactEntity(people(), row)).toEqual({
            id: "p1",
            name: "Ada",
            ssn: REDACTED,
            pin: null,
            address: { street: REDACTED, city: "London" },
        });
    });

    it("leaves the row it was given unchanged", () => {
        const copy = structuredClone(row);

        redactEntity(people(), row);

        expect(row).toEqual(copy);
    });

    it("returns the row itself when the schema has nothing sensitive", () => {
        const plain = s.define("plain", { id: s.string().key() }).compile();

        expect(redactEntity(plain, row)).toBe(row);
    });

    it("returns a value that is not an object as it is", () => {
        expect(redactEntity(people(), "p1")).toBe("p1");
        expect(redactEntity(people(), null)).toBeNull();
        expect(redactEntity(people(), [row])).toEqual([row]);
    });

    it("leaves a nested path alone when its parent is not an object", () => {
        expect(redactEntity(people(), { ...row, address: "unknown" })).toEqual({ ...row, ssn: REDACTED, address: "unknown" });
    });
});
