import { describe, expect, it } from "@jest/globals";
import { ComparatorExpression, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { s } from "@routier/core/schema";
import { JSON_LIST_FROM, toSql, type SqlDialectName } from "./sql";

const items = s.define("list_items", { id: s.string().key(), size: s.number() }).compile();

const idProperty = items.properties.find(property => property.name === "id");

const membership = (values: readonly (string | number | boolean | null | Date)[], negated = false) => {
    if (idProperty === undefined) {
        throw new Error("The id property is missing");
    }

    return new ComparatorExpression({
        comparator: "includes",
        negated,
        strict: false,
        left: new ValueExpression({ value: values }),
        right: new PropertyExpression({ property: idProperty }),
    });
};

const strings = (count: number) => Array.from({ length: count }, (_, i) => `i${i}`);

describe("rendering a list of values", () => {
    it("binds one parameter per value up to the threshold", () => {
        const result = toSql(membership(strings(JSON_LIST_FROM)), "sqlite");

        expect(result.where).toBe(`"id" IN (${strings(JSON_LIST_FROM).map(() => "?").join(", ")})`);
        expect(result.params).toEqual(strings(JSON_LIST_FROM));
    });

    it("binds a longer list as one JSON parameter in SQLite", () => {
        const values = strings(JSON_LIST_FROM + 1);
        const result = toSql(membership(values), "sqlite");

        expect(result.where).toBe(`"id" IN (SELECT value FROM json_each(?))`);
        expect(result.params).toEqual([JSON.stringify(values)]);
    });

    it("negates the JSON form", () => {
        expect(toSql(membership(strings(JSON_LIST_FROM + 1), true), "sqlite").where).toBe(`"id" NOT IN (SELECT value FROM json_each(?))`);
    });

    it("encodes booleans and keeps numbers and nulls in the JSON", () => {
        const values = [...strings(JSON_LIST_FROM), true, false, 2.5, null];

        expect(toSql(membership(values), "sqlite").params).toEqual([JSON.stringify([...strings(JSON_LIST_FROM), 1, 0, 2.5, null])]);
    });

    it.each<[string, string | number | boolean | null | Date]>([
        ["a Date", new Date(0)],
        ["a non-finite number", Number.POSITIVE_INFINITY],
        ["NaN", Number.NaN],
    ])("keeps placeholders when the list holds %s, which JSON cannot carry exactly", (_label, odd) => {
        const values = [...strings(JSON_LIST_FROM), odd];
        const result = toSql(membership(values), "sqlite");

        expect(result.params).toHaveLength(values.length);
        expect(result.where).not.toContain("json_each");
    });

    it.each<SqlDialectName>(["postgresql", "mysql", "mssql"])("leaves %s binding one parameter per value", dialect => {
        expect(toSql(membership(strings(JSON_LIST_FROM + 1)), dialect).params).toHaveLength(JSON_LIST_FROM + 1);
    });
});
