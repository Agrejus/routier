import { describe, expect, it } from "@jest/globals";
import { HashType, s } from ".";

/**
 * Direct coverage for the compiled-schema generators that had none: freeze,
 * enableChangeTracking, getHashType, preprocess, deserializePartial, and getIndexes.
 *
 * These assert behavior through compiled schemas rather than against generated source
 * strings, so they stay valid if codegen is restructured.
 */

const plain = (value: any): any => JSON.parse(JSON.stringify(value));

describe("freeze", () => {
    const schema = s.define("freeze_target", {
        id: s.string().key(),
        text: s.string(),
        nested: s.object({ inner: s.object({ value: s.string() }) }),
        values: s.array(s.string()),
    }).compile();

    const build = () => ({
        id: "a",
        text: "hello",
        nested: { inner: { value: "deep" } },
        values: ["one", "two"],
    }) as any;

    it("freezes the root object", () => {
        expect(Object.isFrozen(schema.freeze(build()))).toBe(true);
    });

    it("freezes nested objects at every depth", () => {
        const frozen: any = schema.freeze(build());

        // A shallow freeze would leave nested writes silently succeeding, which is the
        // failure mode an immutable collection is meant to rule out.
        expect(Object.isFrozen(frozen.nested)).toBe(true);
        expect(Object.isFrozen(frozen.nested.inner)).toBe(true);
    });

    // Arrays are leaf properties in codegen, so they need their own freeze handler
    // (FreezeArrayHandler) — the object handler never visits them.
    it("freezes arrays", () => {
        const frozen: any = schema.freeze(build());

        expect(Object.isFrozen(frozen.values)).toBe(true);
        expect(() => frozen.values.push("three")).toThrow();
    });

    it("rejects writes to root and nested properties", () => {
        const frozen: any = schema.freeze(build());

        expect(() => { frozen.text = "changed"; }).toThrow();
        expect(() => { frozen.nested.inner.value = "changed"; }).toThrow();
    });

    it("preserves values while freezing", () => {
        const original = build();

        expect(plain(schema.freeze(build()))).toEqual(plain(original));
    });
});

describe("computed keys and identities", () => {
    const fastHash = (value: string) => {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash * 31 + value.charCodeAt(i)) | 0;
        }
        return hash;
    };

    const contentKeyed = s.define("computed_key_target", {
        name: s.string(),
    }).modify(x => ({
        id: x.computed((entity: any, _: any, deps: any) => deps.fastHash(JSON.stringify(entity)), { fastHash }).tracked().key(),
    })).compile();

    const identityComputed = s.define("computed_identity_target", {
        name: s.string(),
    }).modify(x => ({
        id: x.computed((entity: any, _: any, deps: any) => deps.fastHash(JSON.stringify(entity)), { fastHash }).tracked().key().identity(),
    })).compile();

    it("computes a computed key once, when absent", () => {
        const enriched: any = contentKeyed.enrich({ name: "a" } as any, "diff");

        expect(enriched.id).toBeDefined();
        expect(enriched.id).toBe(contentKeyed.enrich({ name: "a" } as any, "diff").id);
    });

    // Compute-once: a key must stay stable once assigned. Recomputing on every enrich
    // made content-hash ids churn as the entity moved through pipeline stages.
    it("never recomputes a computed key that is already present", () => {
        const enriched: any = contentKeyed.enrich({ name: "a", id: 999 } as any, "diff");

        expect(enriched.id).toBe(999);
    });

    // An identity-flagged computed key cannot be database-assigned — the database
    // cannot run the compute function. It computes client-side like any computed key.
    it("computes an identity-flagged computed key when absent", () => {
        const enriched: any = identityComputed.enrich({ name: "a" } as any, "diff");

        expect(enriched.id).toBeDefined();
    });
});

describe("enableChangeTracking", () => {
    const schema = s.define("tracking_target", {
        id: s.string().key(),
        text: s.string(),
        count: s.number(),
    }).compile();

    const build = () => ({ id: "a", text: "hello", count: 1 }) as any;

    it("adds no tracking metadata until something changes", () => {
        const tracked: any = schema.enableChangeTracking(build());

        // Tracking state is created lazily. An untouched entity carrying tracking
        // bookkeeping would report itself dirty to every consumer that checks.
        expect(tracked.__tracking__).toBeUndefined();
        expect(Object.keys(tracked)).toEqual(["id", "text", "count"]);
    });

    it("records the changed property and its original value on mutation", () => {
        const tracked: any = schema.enableChangeTracking(build());

        tracked.text = "changed";

        expect(tracked.__tracking__.isDirty).toBe(true);
        expect(tracked.__tracking__.changes).toEqual({ text: "changed" });
        expect(tracked.__tracking__.original).toEqual({ text: "hello" });
    });

    it("accumulates multiple changed properties", () => {
        const tracked: any = schema.enableChangeTracking(build());

        tracked.text = "changed";
        tracked.count = 2;

        expect(tracked.__tracking__.changes).toEqual({ text: "changed", count: 2 });
        expect(tracked.__tracking__.original).toEqual({ text: "hello", count: 1 });
    });

    it("keeps the first original value when a property changes twice", () => {
        const tracked: any = schema.enableChangeTracking(build());

        tracked.text = "first";
        tracked.text = "second";

        expect(tracked.__tracking__.changes).toEqual({ text: "second" });
        // The original is the value as loaded, not the previous intermediate write —
        // otherwise a delta computed against it would omit part of the change.
        expect(tracked.__tracking__.original).toEqual({ text: "hello" });
    });

    it("reflects the assigned value when read back", () => {
        const tracked: any = schema.enableChangeTracking(build());

        tracked.text = "changed";

        expect(tracked.text).toBe("changed");
    });
});

describe("getHashType", () => {
    const plainKey = s.define("hashtype_plain", {
        id: s.string().key(),
        text: s.string(),
    }).compile();

    const identityKey = s.define("hashtype_identity", {
        id: s.string().key().identity(),
        text: s.string(),
    }).compile();

    it("hashes by ids when an identity key is present", () => {
        expect(identityKey.getHashType({ id: "assigned", text: "t" } as any)).toBe(HashType.Ids);
    });

    it("hashes by object when an identity key has not been assigned yet", () => {
        // A new entity has no identity value, so there is no id to hash. Falling back to
        // the object's contents is what lets an unsaved entity be identified at all.
        expect(identityKey.getHashType({ text: "t" } as any)).toBe(HashType.Object);
    });

    it("hashes by ids for a caller-supplied key", () => {
        // A non-identity key is always supplied by the caller, so there is no unassigned
        // state to fall back from.
        expect(plainKey.getHashType({ id: "supplied", text: "t" } as any)).toBe(HashType.Ids);
    });

    it("agrees with the schema's declared hashType for saved entities", () => {
        expect(identityKey.getHashType({ id: "assigned", text: "t" } as any)).toBe(identityKey.hashType);
        expect(plainKey.getHashType({ id: "supplied", text: "t" } as any)).toBe(plainKey.hashType);
    });
});

describe("preprocess", () => {
    it("applies from() renames on the way out", () => {
        const schema = s.define("preprocess_rename", {
            id: s.string().key(),
            value: s.string().from("wire_value"),
        }).compile();

        const wire: any = schema.preprocess(plain({ id: "a", value: "hello" }));

        expect(wire.wire_value).toBe("hello");
        expect("value" in wire).toBe(false);
    });

    it("applies custom serializers", () => {
        const schema = s.define("preprocess_serialize", {
            id: s.string().key(),
            count: s.number().serialize(v => `N${v}`).deserialize(v => Number(String(v).slice(1))),
        }).compile();

        expect((schema.preprocess(plain({ id: "a", count: 7 })) as any).count).toBe("N7");
    });

    it("round-trips back to the application shape through deserialize", () => {
        const schema = s.define("preprocess_roundtrip", {
            id: s.string().key(),
            renamed: s.string().from("wire_renamed"),
            count: s.number().serialize(v => `N${v}`).deserialize(v => Number(String(v).slice(1))),
            nested: s.object({ value: s.string() }),
        }).compile();

        const app = { id: "a", renamed: "r", count: 7, nested: { value: "n" } };
        const wire = schema.preprocess(plain(app));

        expect(plain(schema.deserialize(plain(wire) as any))).toEqual(app);
    });

    it("leaves defaults to enrich rather than applying them itself", () => {
        const schema = s.define("preprocess_defaults", {
            id: s.string().key(),
            flag: s.boolean().default(false),
            label: s.string().default("fallback"),
        }).compile();

        // Defaults belong to enrich, which runs when an entity is instantiated or attached
        // (ChangeTracker.instance). preprocess only prepares and serializes, so a property
        // absent here stays absent. Pinned because "preprocess handles the write path" makes
        // it a natural place to look for defaults.
        const wire: any = schema.preprocess({ id: "a" } as any);
        expect(wire.flag).toBeUndefined();
        expect(wire.label).toBeUndefined();

        const enriched: any = schema.enrich({ id: "a" } as any, "diff");
        expect(enriched.flag).toBe(false);
        expect(enriched.label).toBe("fallback");
    });

    it("preserves explicitly falsy values through serialization", () => {
        const schema = s.define("preprocess_falsy", {
            id: s.string().key(),
            count: s.number().default(99),
            label: s.string().default("fallback"),
            flag: s.boolean().default(true),
        }).compile();

        // 0, "" and false are what truthiness guards silently replace with a default.
        const wire: any = schema.preprocess({ id: "a", count: 0, label: "", flag: false } as any);

        expect(wire.count).toBe(0);
        expect(wire.label).toBe("");
        expect(wire.flag).toBe(false);
    });

    it("does not overwrite explicitly falsy values with defaults during enrich", () => {
        const schema = s.define("enrich_falsy", {
            id: s.string().key(),
            count: s.number().default(99),
            label: s.string().default("fallback"),
            flag: s.boolean().default(true),
        }).compile();

        const enriched: any = schema.enrich({ id: "a", count: 0, label: "", flag: false } as any, "diff");

        expect(enriched.count).toBe(0);
        expect(enriched.label).toBe("");
        expect(enriched.flag).toBe(false);
    });
});

describe("deserializePartial", () => {
    const schema = s.define("partial_target", {
        id: s.string().key(),
        a: s.number().serialize(v => `A${v}`).deserialize(v => Number(String(v).slice(1))),
        b: s.number().serialize(v => `B${v}`).deserialize(v => Number(String(v).slice(1))),
    }).compile();

    const wire = () => plain(schema.preprocess(plain({ id: "x", a: 1, b: 2 })));

    it("deserializes only the requested properties", () => {
        const property = schema.properties.find(p => p.name === "a")!;

        const result: any = schema.deserializePartial(wire(), [property]);

        expect(result.a).toBe(1);
        // `b` was not requested, so it stays in wire form. This is selective
        // deserialization, not projection — untouched properties are left as they were.
        expect(result.b).toBe("B2");
    });

    it("leaves the item untouched for an empty property list", () => {
        const original = wire();

        expect(schema.deserializePartial(wire(), [])).toEqual(original);
    });

    it("matches full deserialize when every property is requested", () => {
        const properties = schema.properties.filter(p => p.parent == null);

        expect(plain(schema.deserializePartial(wire(), properties))).toEqual(
            plain(schema.deserialize(wire() as any))
        );
    });

    it("skips properties absent from the item", () => {
        const property = schema.properties.find(p => p.name === "a")!;

        expect(schema.deserializePartial({ id: "x" }, [property])).toEqual({ id: "x" });
    });
});

describe("getIndexes", () => {
    it("returns no indexes when none are declared", () => {
        const schema = s.define("index_none", {
            id: s.string().key(),
            text: s.string(),
        }).compile();

        expect(schema.getIndexes()).toEqual([]);
    });

    it("reports a named single-property index", () => {
        const schema = s.define("index_single", {
            id: s.string().key(),
            count: s.number().index("count_idx"),
        }).compile();

        const [index] = schema.getIndexes();

        expect(index.name).toBe("count_idx");
        expect(index.type).toBe("single");
        expect(index.properties.map(p => p.name)).toEqual(["count"]);
    });

    it("groups properties sharing an index name into one compound index", () => {
        const schema = s.define("index_compound", {
            id: s.string().key(),
            a: s.string().index("ab"),
            b: s.string().index("ab"),
        }).compile();

        const indexes = schema.getIndexes();

        expect(indexes).toHaveLength(1);
        expect(indexes[0].type).toBe("compound");
        expect(indexes[0].properties.map(p => p.name)).toEqual(["a", "b"]);
    });

    it("auto-names an index declared without a name", () => {
        const schema = s.define("index_unnamed", {
            id: s.string().key(),
            c: s.string().index(),
        }).compile();

        const [index] = schema.getIndexes();

        expect(index.type).toBe("single");
        expect(index.properties.map(p => p.name)).toEqual(["c"]);
        expect(index.name.length).toBeGreaterThan(0);
    });

    it("keeps compound and single indexes separate in one schema", () => {
        const schema = s.define("index_mixed", {
            id: s.string().key(),
            a: s.string().index("ab"),
            b: s.string().index("ab"),
            solo: s.string().index("solo_idx"),
        }).compile();

        const indexes = schema.getIndexes();
        const byName = new Map(indexes.map(i => [i.name, i]));

        expect(indexes).toHaveLength(2);
        expect(byName.get("ab")!.type).toBe("compound");
        expect(byName.get("solo_idx")!.type).toBe("single");
    });

    it("does not emit an index for a composite key", () => {
        const schema = s.define("index_composite_key", {
            a: s.string().key(),
            b: s.string().key(),
        }).compile();

        // Composite keys are not surfaced as indexes: plugins derive key handling from
        // idProperties instead. Pinned because IndexType includes "primary-key", which
        // makes the absence look like an oversight rather than a decision.
        expect(schema.getIndexes()).toEqual([]);
        expect(schema.idProperties.map(p => p.name)).toEqual(["a", "b"]);
    });
});
