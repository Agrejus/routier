import { describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import { ChangeTracker } from "./ChangeTracker";

/**
 * Coverage for the change tracker's attachment identity, dirty detection, tag lifecycle,
 * and reset behavior — the state that decides what a saveChanges actually persists.
 */

const schema = s.define("tracker_target", {
    id: s.string().key(),
    text: s.string(),
    count: s.number(),
}).compile();

const nestedSchema = s.define("tracker_nested", {
    id: s.string().key(),
    nested: s.object({ value: s.string() }),
}).compile();

const arraySchema = s.define("tracker_array", {
    id: s.string().key(),
    values: s.array(s.string()),
}).compile();

const tracker = () => new ChangeTracker(schema as any);
const entity = (id: string, text = "hello", count = 1) => ({ id, text, count }) as any;

describe("ChangeTracker attachment", () => {
    it("returns the entity it was given for a first attach", () => {
        const target = entity("a");

        expect(tracker().resolve(target, null)).toBe(target);
    });

    it("returns the canonical instance for a second attach of the same key", () => {
        const changeTracker = tracker();
        const first = entity("a", "first");
        const second = entity("a", "second");

        const attached = changeTracker.resolve(first, null);
        const reattached = changeTracker.resolve(second, null);

        // Two reads of the same row must converge on one object, or a caller holding the
        // first copy would not see writes made through the second.
        expect(reattached).toBe(attached);
        expect(reattached).not.toBe(second);
    });

    it("leaves the canonical instance untouched when merge is not requested", () => {
        const changeTracker = tracker();
        const attached: any = changeTracker.resolve(entity("a", "first"), null);

        changeTracker.resolve(entity("a", "second"), null);

        expect(attached.text).toBe("first");
    });

    it("merges incoming values into the canonical instance when asked", () => {
        const changeTracker = tracker();
        const attached: any = changeTracker.resolve(entity("a", "first"), null);

        changeTracker.resolve(entity("a", "second", 2), null, { merge: true });

        expect(attached.text).toBe("second");
        expect(attached.count).toBe(2);
    });

    it("keeps entities with different keys separate", () => {
        const changeTracker = tracker();

        const a = changeTracker.resolve(entity("a"), null);
        const b = changeTracker.resolve(entity("b"), null);

        expect(a).not.toBe(b);
        expect(changeTracker.isAttached(entity("a"))).toBe(true);
        expect(changeTracker.isAttached(entity("b"))).toBe(true);
    });

    it("reports an unattached entity as not attached", () => {
        expect(tracker().isAttached(entity("missing"))).toBe(false);
    });

    it("attaches many entities in one call, preserving order", () => {
        const changeTracker = tracker();
        const entities = [entity("a"), entity("b"), entity("c")];

        const attached = changeTracker.resolveMany(entities, null);

        expect(attached).toHaveLength(3);
        expect(attached.map((e: any) => e.id)).toEqual(["a", "b", "c"]);
    });
});

describe("ChangeTracker dirty detection", () => {
    it("reports no changes for a freshly constructed tracker", () => {
        expect(tracker().hasChanges()).toBe(false);
    });

    it("reports no changes when an attached entity is untouched", () => {
        const changeTracker = tracker();
        changeTracker.resolve(entity("a"), null);

        expect(changeTracker.hasChanges()).toBe(false);
    });

    it("reports changes once an attached entity is marked dirty", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), null);

        changeTracker.markDirty([attached]);

        expect(changeTracker.hasChanges()).toBe(true);
    });

    it("reports changes after a removal is queued", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), null);

        changeTracker.remove([attached], null, () => { /* result unused */ });

        expect(changeTracker.hasChanges()).toBe(true);
    });

    it("lists queued removals for persistence", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), null);

        changeTracker.remove([attached], null, () => { /* result unused */ });

        expect(changeTracker.prepareRemovals()).toHaveLength(1);
    });

    it("detects a mutation made through a change-tracked instance", () => {
        const changeTracker = tracker();
        const tracked: any = schema.enrich(entity("a"), "proxy");
        changeTracker.resolve(tracked, null);

        tracked.text = "changed";

        // Dirty state comes from the enriched entity's own tracking, so the tracker must
        // read through to it rather than keeping a separate copy.
        expect(changeTracker.hasChanges()).toBe(true);
    });

    // Nested objects are proxied with the root passed as tracking parent, so a nested
    // write records against the root's __tracking__ under its full dotted path.
    it("detects a mutation nested inside an object property", () => {
        const nestedTracker = new ChangeTracker(nestedSchema as any);
        const tracked: any = nestedSchema.enrich({ id: "a", nested: { value: "before" } } as any, "proxy");
        nestedTracker.resolve(tracked, null);

        tracked.nested.value = "after";

        expect(nestedTracker.hasChanges()).toBe(true);
    });

    // Arrays are wrapped in the tracking proxy with the root as parent, so in-place
    // mutations (push/splice/index writes) mark the root entity dirty rather than being
    // silently discarded on save.
    it("detects an in-place mutation of an array property", () => {
        const arrayTracker = new ChangeTracker(arraySchema as any);
        const tracked: any = arraySchema.enrich({ id: "a", values: ["one"] } as any, "proxy");
        arrayTracker.resolve(tracked, null);

        tracked.values.push("two");

        expect(tracked.values).toEqual(["one", "two"]);
        expect(arrayTracker.hasChanges()).toBe(true);
    });

    // Guards the fix for defect #12: merge used to replace the array REFERENCE
    // (`destination.values = source.values`), discarding the tracking proxy, so every
    // in-place array mutation made after the entity's first save was silently lost.
    // MergeArrayHandler now copies elements into the destination's existing array.
    it("detects an in-place array mutation after the entity has been merged", () => {
        const arrayTracker = new ChangeTracker(arraySchema as any);
        const tracked: any = arraySchema.enrich({ id: "a", values: ["one"] } as any, "proxy");
        arrayTracker.resolve(tracked, null);

        // What afterPersist does to every updated entity once the plugin echoes it back.
        (arraySchema as any).merge(tracked, { id: "a", values: ["one"] });

        tracked.values.push("two");

        expect(arrayTracker.hasChanges()).toBe(true);
    });

    // Companion to the defect-#12 fix, the re-query flavor: resolving a fresh read into an
    // already-attached entity merges through the same path, and the source there is itself
    // a proxy — bound to the throwaway enriched object, not to the canonical. Adopting that
    // reference would record mutations on an object nobody holds.
    it("detects an in-place array mutation after a re-query has been merged in", () => {
        const arrayTracker = new ChangeTracker(arraySchema as any);
        const tracked: any = arraySchema.enrich({ id: "a", values: ["one"] } as any, "proxy");
        arrayTracker.resolve(tracked, null);

        // What QueryableExecutor.attachResults does on a re-read of an attached row.
        const fresh: any = arraySchema.enrich({ id: "a", values: ["one"] } as any, "proxy");
        (arraySchema as any).merge(tracked, fresh);

        expect(tracked.values).not.toBe(fresh.values);

        tracked.values.push("two");

        expect(arrayTracker.hasChanges()).toBe(true);
        // The mutation must land on the canonical's array, not the throwaway's.
        expect(fresh.values).toEqual(["one"]);
    });

    // Guards the fix for defect #13: `__tracking__.changes` is keyed by dotted path, and
    // `getAttachmentsChanges` used to feed it to the entity-shaped `serialize`, which threw
    // at depth 2. The delta is now selected out of the complete serialized entity, with a
    // dotted key resolved by its root segment.
    it("serializes the delta for a mutation two levels deep", () => {
        const deepSchema = s.define("tracker_deep2", {
            id: s.string().key(),
            nested: s.object({ inner: s.object({ value: s.string() }) }),
        }).compile();
        const deepTracker = new ChangeTracker(deepSchema as any);
        const tracked: any = deepSchema.enrich({ id: "a", nested: { inner: { value: "before" } } } as any, "proxy");
        deepTracker.resolve(tracked, null);

        tracked.nested.inner.value = "after";

        // The tracking itself is correct — it is only the serialization that failed.
        expect(tracked.__tracking__.changes).toEqual({ "nested.inner.value": "after" });

        const changes = deepTracker.getAttachmentsChanges();

        expect(changes).toHaveLength(1);
        // A dotted change key selects its ROOT column, and the subtree is sent whole —
        // a partial subtree in a JSON column would drop the siblings that did not change.
        expect(changes[0].delta).toEqual({ nested: { inner: { value: "after" } } });
    });

    // Companion to the defect-#13 fix: depth 1 used to produce a silently WRONG delta
    // ({ nested: {} } — the value dropped), masked only because JSON-column consumers take
    // values from the entity rather than the delta.
    it("serializes the delta for a mutation one level deep", () => {
        const nestedTracker = new ChangeTracker(nestedSchema as any);
        const tracked: any = nestedSchema.enrich({ id: "a", nested: { value: "before" } } as any, "proxy");
        nestedTracker.resolve(tracked, null);

        tracked.nested.value = "after";

        const changes = nestedTracker.getAttachmentsChanges();

        expect(changes).toHaveLength(1);
        expect(changes[0].delta).toEqual({ nested: { value: "after" } });
    });

    // Companion to the defect-#13 fix: an in-place array mutation used to serialize to an
    // empty delta ({}), persisting only via the SQL layer's whole-entity fallback.
    it("serializes the delta for an in-place array mutation", () => {
        const arrayTracker = new ChangeTracker(arraySchema as any);
        const tracked: any = arraySchema.enrich({ id: "a", values: ["one"] } as any, "proxy");
        arrayTracker.resolve(tracked, null);

        tracked.values.push("two");

        const changes = arrayTracker.getAttachmentsChanges();

        expect(changes).toHaveLength(1);
        expect(changes[0].delta).toEqual({ values: ["one", "two"] });
    });

    // Guards the fix for defect #11: an entity that has been persisted must go clean, or
    // it is re-sent as an update on every later save and a removed row comes back.
    it("stops reporting changes once its update has been merged", () => {
        const changeTracker = tracker();
        const tracked: any = schema.enrich(entity("a"), "proxy");
        changeTracker.resolve(tracked, null);

        tracked.text = "changed";
        expect(changeTracker.hasChanges()).toBe(true);

        changeTracker.mergeChanges({ updates: [tracked], adds: [], removes: [] } as any);

        expect(changeTracker.hasChanges()).toBe(false);
    });

    it("does not report changes when an array read leaves values untouched", () => {
        const arrayTracker = new ChangeTracker(arraySchema as any);
        const tracked: any = arraySchema.enrich({ id: "a", values: ["one"] } as any, "proxy");
        arrayTracker.resolve(tracked, null);

        const copy = tracked.values.map((v: string) => v);

        expect(copy).toEqual(["one"]);
        expect(arrayTracker.hasChanges()).toBe(false);
    });

    it("does not report changes when a nested read leaves values untouched", () => {
        const nestedTracker = new ChangeTracker(nestedSchema as any);
        const tracked: any = nestedSchema.enrich({ id: "a", nested: { value: "before" } } as any, "proxy");
        nestedTracker.resolve(tracked, null);

        // Reading through the proxy must not itself dirty the entity, or every query would
        // queue a pointless write.
        expect(tracked.nested.value).toBe("before");
        expect(nestedTracker.hasChanges()).toBe(false);
    });
});

describe("ChangeTracker additions", () => {
    it("counts an added entity as a change", () => {
        const changeTracker = tracker();

        changeTracker.add([{ id: "a", text: "t", count: 1 }] as any, null, () => { /* result unused */ });

        expect(changeTracker.hasChanges()).toBe(true);
    });

    it("returns the enriched entities through the callback", () => {
        const changeTracker = tracker();
        let returned: any[] = [];

        changeTracker.add([{ id: "a", text: "t", count: 1 }] as any, null, result => {
            returned = (result as any).data ?? [];
        });

        expect(returned).toHaveLength(1);
        expect(returned[0].id).toBe("a");
    });
});

describe("ChangeTracker reset", () => {
    it("drops queued additions", () => {
        const changeTracker = tracker();
        changeTracker.add([{ id: "a", text: "t", count: 1 }] as any, null, () => { /* unused */ });

        changeTracker.clearChanges();

        expect(changeTracker.hasChanges()).toBe(false);
    });

    it("drops queued removals", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), null);
        changeTracker.remove([attached], null, () => { /* result unused */ });

        changeTracker.clearChanges();

        expect(changeTracker.prepareRemovals()).toHaveLength(0);
        expect(changeTracker.hasChanges()).toBe(false);
    });

    it("keeps an entity attached after clearing changes", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), null);

        changeTracker.clearChanges();

        // clearChanges discards pending work, not the identity map: an attached entity must
        // stay attached so later reads keep converging on it.
        expect(changeTracker.isAttached(attached)).toBe(true);
    });
});

describe("ChangeTracker detach", () => {
    it("removes an entity from the identity map", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), null);

        changeTracker.detach([attached]);

        expect(changeTracker.isAttached(attached)).toBe(false);
    });

    it("lets a detached entity attach again as a new canonical instance", () => {
        const changeTracker = tracker();
        const first = changeTracker.resolve(entity("a"), null);
        changeTracker.detach([first]);

        const second = entity("a", "second");

        expect(changeTracker.resolve(second, null)).toBe(second);
    });

    it("leaves other entities attached", () => {
        const changeTracker = tracker();
        const a = changeTracker.resolve(entity("a"), null);
        const b = changeTracker.resolve(entity("b"), null);

        changeTracker.detach([a]);

        expect(changeTracker.isAttached(a)).toBe(false);
        expect(changeTracker.isAttached(b)).toBe(true);
    });
});

describe("ChangeTracker queries over attachments", () => {
    it("finds an attached entity by predicate", () => {
        const changeTracker = tracker();
        changeTracker.resolve(entity("a", "match"), null);
        changeTracker.resolve(entity("b", "other"), null);

        expect((changeTracker.findAttached((e: any) => e.text === "match") as any)?.id).toBe("a");
    });

    it("returns undefined when no attached entity matches", () => {
        const changeTracker = tracker();
        changeTracker.resolve(entity("a", "match"), null);

        expect(changeTracker.findAttached((e: any) => e.text === "absent")).toBeUndefined();
    });

    it("filters attached entities by predicate", () => {
        const changeTracker = tracker();
        changeTracker.resolve(entity("a", "keep"), null);
        changeTracker.resolve(entity("b", "keep"), null);
        changeTracker.resolve(entity("c", "drop"), null);

        expect(changeTracker.filterAttached((e: any) => e.text === "keep")).toHaveLength(2);
    });
});

describe("ChangeTracker tags", () => {
    it("records a tag supplied at attach time", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), "tag-value");

        expect(changeTracker.tags.get().get(attached as object)).toBe("tag-value");
    });

    it("keeps tags per entity", () => {
        const changeTracker = tracker();
        const a = changeTracker.resolve(entity("a"), "tag-a");
        const b = changeTracker.resolve(entity("b"), "tag-b");

        const tags = changeTracker.tags.get();

        expect(tags.get(a as object)).toBe("tag-a");
        expect(tags.get(b as object)).toBe("tag-b");
        expect(tags.size).toBe(2);
    });

    it("records no tag when none is supplied", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), null);

        expect(changeTracker.tags.get().has(attached as object)).toBe(false);
    });

    it("attaches one tag to every entity in a resolveMany call", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolveMany([entity("a"), entity("b")], "shared");
        const tags = changeTracker.tags.get();

        expect(tags.get(attached[0] as object)).toBe("shared");
        expect(tags.get(attached[1] as object)).toBe("shared");
    });

    it("tags every removed entity", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolveMany([entity("a"), entity("b")], null);

        changeTracker.remove(attached, "removal-tag", () => { /* result unused */ });
        const tags = changeTracker.tags.get();

        // setMany is the path here rather than repeated set, so a size that disagrees with
        // the entry count would show up as a wrong tag count on every bulk removal.
        expect(tags.get(attached[0] as object)).toBe("removal-tag");
        expect(tags.get(attached[1] as object)).toBe("removal-tag");
        expect(tags.size).toBe(2);
    });

    it("drops the tag collection on destroy", () => {
        const changeTracker = tracker();
        const attached = changeTracker.resolve(entity("a"), "tag-value");

        changeTracker.tags.destroy();

        expect(changeTracker.tags.get().has(attached as object)).toBe(false);
    });
});

/**
 * Updating a row that has been added but not yet saved.
 *
 * These rows cannot be resolved by id — an identity-keyed one has no id until the database
 * assigns it — so they are keyed by object reference. The risk that keying buys is a slot
 * that outlives the additions it names: patching one of those would put the row back into
 * `additions` and insert something the caller had already been told was gone.
 */
describe("ChangeTracker unsaved-row updates", () => {
    const added = (changeTracker: ChangeTracker<any>, value: any) => {
        let result: any;
        changeTracker.add([value], null, r => { result = (r as any).data[0]; }, "immutable");
        return result;
    };

    it("patches a pending addition in place of recording an update", () => {
        const changeTracker = tracker();
        const first = added(changeTracker, entity("a", "first"));

        changeTracker.updateImmutable(first, { text: "second" });

        // One pending add carrying the new value, and no pending update beside it.
        expect(changeTracker.prepareAdditions()).toEqual([
            expect.objectContaining({ id: "a", text: "second" }),
        ]);
        expect(changeTracker.getAttachmentsChanges()).toHaveLength(0);
    });

    it("resolves every generation of the reference to the same row", () => {
        const changeTracker = tracker();
        const v1 = added(changeTracker, entity("a", "first"));

        const v2 = changeTracker.updateImmutable(v1, { text: "second" }) as any;
        changeTracker.updateImmutable(v1, { count: 9 });

        expect(changeTracker.prepareAdditions()).toHaveLength(1);
        expect(changeTracker.currentOf(v1)).toEqual(expect.objectContaining({ text: "second", count: 9 }));
        expect(changeTracker.currentOf(v2)).toBe(changeTracker.currentOf(v1));
    });

    it("does not modify the reference it was given", () => {
        const changeTracker = tracker();
        const first = added(changeTracker, entity("a", "first"));

        changeTracker.updateImmutable(first, { text: "second" });

        expect(first.text).toBe("first");
    });

    it("refuses to patch a pending addition that was dropped", () => {
        const changeTracker = tracker();
        const first = added(changeTracker, entity("a", "first"));

        // What a failed save does: the row never reached the database.
        changeTracker.clearChanges();

        expect(() => changeTracker.updateImmutable(first, { text: "second" }))
            .toThrow(/not attached/);
        // And the refusal must not have re-entered it as an addition.
        expect(changeTracker.prepareAdditions()).toHaveLength(0);
        expect(changeTracker.hasChanges()).toBe(false);
    });

    it("leaves an unsaved row unfrozen, as the add path requires", () => {
        const changeTracker = tracker();
        const first = added(changeTracker, entity("a", "first"));

        // Freezing is deliberately kept off the add path: `mergeChanges` writes the
        // database's assigned identity into the entity it just persisted, which a frozen
        // object would reject. Reads are frozen; a row still being composed is not — and a
        // patch must not quietly change that.
        expect(Object.isFrozen(first)).toBe(false);
        expect(Object.isFrozen(changeTracker.updateImmutable(first, { text: "second" }))).toBe(false);
    });
});
