import { describe, expect, it } from "@jest/globals";
import { PROPERTY_ORDERS, SHAPE_SPECS, shapeCatalog, shapesWithTags } from "./shapeCatalog";

describe("shape catalog", () => {
    it("compiles every spec in every property order", () => {
        const cases = shapeCatalog();

        expect(cases).toHaveLength(SHAPE_SPECS.length * PROPERTY_ORDERS.length);
        for (const shapeCase of cases) {
            expect(shapeCase.schema).toBeDefined();
            expect(shapeCase.schema.properties.length).toBeGreaterThan(0);
        }
    });

    it("gives every shape a distinct schema id", () => {
        const ids = shapeCatalog().map(c => c.schema.id);

        // A schema id is hashed from property names and collection name. Collisions would
        // silently alias two shapes onto one compiled schema and hide whichever compiles
        // second, so this is load-bearing rather than cosmetic.
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("declares a key on every shape", () => {
        for (const shapeCase of shapeCatalog()) {
            expect(shapeCase.schema.idProperties.length).toBeGreaterThan(0);
        }
    });

    it("varies key position across orders for the same spec", () => {
        const multi = shapeCatalog().filter(c => c.spec.name === "multi-scalar");
        const keyIndexes = multi.map(c => c.propertyNames.indexOf("id"));

        expect(multi).toHaveLength(PROPERTY_ORDERS.length);
        // If every order produced the same key index the order dimension would be inert.
        expect(new Set(keyIndexes).size).toBeGreaterThan(1);
    });

    it("selects subsets by tag", () => {
        const dates = shapesWithTags("date");

        expect(dates.length).toBeGreaterThan(0);
        for (const shapeCase of dates) {
            expect(shapeCase.spec.tags).toContain("date");
        }
    });
});
