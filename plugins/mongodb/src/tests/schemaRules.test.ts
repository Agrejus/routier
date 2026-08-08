import { describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import { assertMongoSchema } from "../schemaRules";

/**
 * The `_id` rule, which the plugin enforces rather than works around.
 *
 * Each message has to name the fix, because this fails when a store is built — before any
 * data exists — and the person reading it has not yet learned what MongoDB requires.
 */
describe("assertMongoSchema", () => {

    it("accepts _id declared as an identity key", () => {
        const schema = s.define("ok", {
            _id: s.string().key().identity(),
            name: s.string(),
        }).compile();

        expect(() => assertMongoSchema(schema)).not.toThrow();
    });

    /**
     * Rejected even though the stored document would be identical.
     *
     * Core routes filters on renamed properties to memory, so a renamed key turns every
     * lookup by id into a full collection fetch — silently, while the document looks right.
     */
    it("rejects a key renamed onto _id, naming the scan it would cause", () => {
        const schema = s.define("renamed", {
            id: s.string().key().from("_id").identity(),
            name: s.string(),
        }).compile();

        expect(() => assertMongoSchema(schema)).toThrow(/renamed with \.from\('_id'\)/);
        expect(() => assertMongoSchema(schema)).toThrow(/fetch the entire collection/);
    });

    it("rejects a key that is not _id, and says how to fix it", () => {
        const schema = s.define("wrongName", {
            id: s.string().key().identity(),
            name: s.string(),
        }).compile();

        expect(() => assertMongoSchema(schema)).toThrow(/reserves '_id'/);
        expect(() => assertMongoSchema(schema)).toThrow(/DECLARED `_id`/);
    });

    it("rejects a composite key rather than encoding one", () => {
        const schema = s.define("composite", {
            tenant: s.string().key(),
            sku: s.string().key(),
        }).compile();

        expect(() => assertMongoSchema(schema)).toThrow(/composite key \(tenant, sku\)/);
    });

    it("rejects _id without identity", () => {
        const schema = s.define("noIdentity", {
            _id: s.string().key(),
            name: s.string(),
        }).compile();

        expect(() => assertMongoSchema(schema)).toThrow(/without `\.identity\(\)`/);
    });

    /**
     * Not this module's job — core refuses a keyless schema at compile time, before a plugin
     * sees it. Asserted here so the absence of a check is a recorded fact rather than a gap.
     */
    it("never sees a keyless schema, because core rejects it first", () => {
        expect(() => s.define("noKey", { name: s.string() }).compile()).toThrow(/must have a key/);
    });
});
