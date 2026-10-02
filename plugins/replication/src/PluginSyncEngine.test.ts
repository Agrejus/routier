import { describe, it, expect, jest } from "@jest/globals";
import type {
    IDbPlugin,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    ITranslatedValue,
} from "@routier/core/plugins";
import { Query } from "@routier/core/plugins";
import { PluginEventResult, Result } from "@routier/core/results";
import { SchemaCollection } from "@routier/core/collections";
import { BulkPersistChanges, BulkPersistResult } from "@routier/core/collections";
import { etags, InferRoot, s } from "@routier/core/schema";
import { PluginSyncEngine } from "./PluginSyncEngine";

const testSchema = s
    .define("testCollection", {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

function createQueryEvent(): DbPluginQueryEvent<Record<string, unknown>, unknown> {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    return {
        id: "query-event",
        schemas,
        source: "test",
        action: "query",
        explain: false,
        executedQueries: [],
        operation: Query.EMPTY(testSchema as any) as any,
    };
}

function createPersistEvent(): DbPluginBulkPersistEvent {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    return {
        id: "persist-event",
        schemas,
        source: "test",
        action: "persist",
        operation: new BulkPersistChanges(),
    };
}

function createDestroyEvent(): DbPluginEvent {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    return {
        id: "destroy-event",
        schemas,
        source: "test",
        action: "destroy",
    };
}

function createTranslated<T>(value: T): ITranslatedValue<T> {
    return {
        value,
        forEach: (_cb: (item: unknown) => unknown) => {},
        get isEmpty() {
            if (Array.isArray(value)) {
                return value.length === 0;
            }
            return value == null;
        },
    } as ITranslatedValue<T>;
}

function createPluginMock() {
    const plugin: IDbPlugin = {
        databaseName: 'sync-mock',
        query: jest.fn() as any,
        bulkPersist: jest.fn() as any,
        destroy: jest.fn() as any,
    };
    return plugin;
}

describe("PluginSyncEngine", () => {
    it("routes query to next plugin when first fails", (done) => {
        const first = createPluginMock();
        const second = createPluginMock();
        const event = createQueryEvent();
        const translated = createTranslated([{ id: "1", name: "A" }]);

        (first.query as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.error(event.id, new Error("first failed"))));
        (second.query as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id, translated)));

        const engine = new PluginSyncEngine({
            source: first,
            queryPlugins: [first, second],
        });

        engine.query(event, (result) => {
            expect(first.query).toHaveBeenCalledTimes(1);
            expect(second.query).toHaveBeenCalledTimes(1);
            expect(result.ok).toBe(Result.SUCCESS);
            if (result.ok === Result.SUCCESS) {
                expect(result.data).toBe(translated);
            }
            done();
        });
    });

    it("surfaces first query error when queryFailureMode=surface-first", (done) => {
        const first = createPluginMock();
        const second = createPluginMock();
        const event = createQueryEvent();

        (first.query as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.error(event.id, new Error("first failed"))));
        (second.query as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.error(event.id, new Error("second failed"))));

        const engine = new PluginSyncEngine({
            source: first,
            queryPlugins: [first, second],
            queryFailureMode: "surface-first",
        });

        engine.query(event, (result) => {
            expect(result.ok).toBe(Result.ERROR);
            if (result.ok === Result.ERROR) {
                expect(String(result.error)).toContain("first failed");
            }
            done();
        });
    });

    it("acknowledges persist after source and swallows mirror failures", (done) => {
        const source = createPluginMock();
        const mirror = createPluginMock();
        const event = createPersistEvent();
        const sourceResult = new Map();
        const onMirrorError = jest.fn();

        (source.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id, sourceResult)));
        (mirror.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.error(event.id, new Error("mirror failed"))));

        const engine = new PluginSyncEngine({
            source,
            mirrorPlugins: [mirror],
            persistAckMode: "after-source",
            mirrorFailureMode: "swallow",
            onMirrorError,
        });

        engine.bulkPersist(event, (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            if (result.ok === Result.SUCCESS) {
                expect(result.data).toBe(sourceResult);
            }
            setTimeout(() => {
                expect(onMirrorError).toHaveBeenCalledTimes(1);
                done();
            }, 0);
        });
    });

    it("surfaces mirror failure in after-all/surface mode", (done) => {
        const source = createPluginMock();
        const mirror = createPluginMock();
        const event = createPersistEvent();
        const sourceResult = new Map();

        (source.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id, sourceResult)));
        (mirror.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.error(event.id, new Error("mirror failed"))));

        const engine = new PluginSyncEngine({
            source,
            mirrorPlugins: [mirror],
            persistAckMode: "after-all",
            mirrorFailureMode: "surface",
        });

        engine.bulkPersist(event, (result) => {
            expect(result.ok).toBe(Result.ERROR);
            if (result.ok === Result.ERROR) {
                expect(String(result.error)).toContain("mirror failed");
            }
            done();
        });
    });

    it("rebuilds mirror payload when mirrorPersistPayloadMode=resolve-from-source-result", (done) => {
        const source = createPluginMock();
        const mirror = createPluginMock();
        const event = createPersistEvent();
        const sourceResult = new Map();
        const originalOperation = new BulkPersistChanges();
        originalOperation.resolve(testSchema.id).adds = [{ id: "temp", name: "Temp" } as any];
        (event as any).operation = originalOperation;

        sourceResult.set(testSchema.id, {
            adds: [{ id: "resolved-id", name: "Resolved" }],
            updates: [],
            removes: [],
            hasItems: true,
        });

        (source.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id, sourceResult)));
        (mirror.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id, new Map())));

        const engine = new PluginSyncEngine({
            source,
            mirrorPlugins: [mirror],
            persistAckMode: "after-all",
            mirrorFailureMode: "surface",
            mirrorPersistPayloadMode: "resolve-from-source-result",
        });

        engine.bulkPersist(event, (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            expect(mirror.bulkPersist).toHaveBeenCalledTimes(1);
            const mirroredEvent = (mirror.bulkPersist as any).mock.calls[0][0];
            expect(mirroredEvent.operation).not.toBe(event.operation);
            const mirroredChanges = mirroredEvent.operation.get(testSchema.id);
            expect(mirroredChanges.adds).toEqual([{ id: "resolved-id", name: "Resolved" }]);
            done();
        });
    });

    it("destroy swallows errors when configured", (done) => {
        const source = createPluginMock();
        const mirror = createPluginMock();
        const event = createDestroyEvent();

        (source.destroy as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id)));
        (mirror.destroy as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.error(event.id, new Error("destroy failed"))));

        const engine = new PluginSyncEngine({
            source,
            mirrorPlugins: [mirror],
            destroyFailureMode: "swallow",
        });

        engine.destroy(event, (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            done();
        });
    });
});


describe("PluginSyncEngine mirror error reporting", () => {
    it("reports the failing mirror plugin itself, not the error-array position", (done) => {
        const source = createPluginMock();
        const okMirror = createPluginMock();
        const failingMirror = createPluginMock();
        const event = createPersistEvent();
        const onMirrorError = jest.fn();

        (source.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id, new Map())));
        (okMirror.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.success(event.id, new Map())));
        (failingMirror.bulkPersist as any).mockImplementation((_event: any, cb: any) => cb(PluginEventResult.error(event.id, new Error("mirror 1 failed"))));

        const engine = new PluginSyncEngine({
            source,
            mirrorPlugins: [okMirror, failingMirror],
            persistAckMode: "after-all",
            mirrorFailureMode: "swallow",
            onMirrorError,
        });

        engine.bulkPersist(event, (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            expect(onMirrorError).toHaveBeenCalledTimes(1);
            const [, context] = onMirrorError.mock.calls[0] as [Error, { plugin: unknown }];
            expect(context.plugin).toBe(failingMirror);
            done();
        });
    });
});

describe("PluginSyncEngine etag mode", () => {
    const recordingPlugin = (events: DbPluginBulkPersistEvent[]): IDbPlugin => ({
        databaseName: "recording",
        query: (event, done) => done(PluginEventResult.error(event.id, new Error("not queried"))),
        bulkPersist: (event, done) => {
            events.push(event);
            const result = new BulkPersistResult();
            result.resolve<InferRoot<typeof testSchema>>(testSchema.id).adds.push({ id: "resolved", name: "Resolved" });
            done(PluginEventResult.success(event.id, result));
        },
        destroy: (event, done) => done(PluginEventResult.success(event.id)),
    });

    const persistEvent = (): DbPluginBulkPersistEvent => {
        const operation = new BulkPersistChanges();
        operation.resolve<InferRoot<typeof testSchema>>(testSchema.id).adds.push({ name: "Temp" });
        return {
            id: "etag-event",
            schemas: new SchemaCollection().set(testSchema.id, testSchema),
            source: "test",
            action: "persist",
            operation,
        };
    };

    it.each(["original-event", "resolve-from-source-result"] as const)(
        "lets the source generate etags and tells the mirror to keep them (%s)",
        async (mirrorPersistPayloadMode) => {
            const sourceEvents: DbPluginBulkPersistEvent[] = [];
            const mirrorEvents: DbPluginBulkPersistEvent[] = [];
            const engine = new PluginSyncEngine({
                source: recordingPlugin(sourceEvents),
                mirrorPlugins: [recordingPlugin(mirrorEvents)],
                persistAckMode: "after-all",
                mirrorFailureMode: "surface",
                mirrorPersistPayloadMode,
            });

            await new Promise(resolve => engine.bulkPersist(persistEvent(), resolve));

            expect([sourceEvents[0]?.etags ?? "generate", mirrorEvents[0]?.etags]).toEqual(["generate", "keep"]);
        }
    );

    const versionedSchema = s.define("syncVersioned", {
        id: s.string().key(),
        name: s.string(),
        version: s.number().etag(etags.numeric),
    }).compile();

    const versionedEvent = (): DbPluginBulkPersistEvent => {
        const operation = new BulkPersistChanges();
        const changes = operation.resolve<InferRoot<typeof versionedSchema>>(versionedSchema.id);
        const row = { id: "a", name: "A", version: 4 };
        changes.adds.push(row);
        changes.updates.push({ entity: row, changeType: "markedDirty", delta: {} });
        changes.removes.push(row);
        return {
            id: "versioned-event",
            schemas: new SchemaCollection().set(versionedSchema.id, versionedSchema),
            source: "test",
            action: "persist",
            operation,
        };
    };

    const echoingPlugin = (events: DbPluginBulkPersistEvent[]): IDbPlugin => ({
        ...recordingPlugin(events),
        bulkPersist: (event, done) => {
            events.push(event);
            const result = new BulkPersistResult();
            for (const [schemaId, changes] of event.operation) {
                const echoed = result.resolve(schemaId);
                echoed.adds.push(...changes.adds);
                echoed.updates.push(...changes.updates.map(update => update.entity));
                echoed.removes.push(...changes.removes);
            }
            done(PluginEventResult.success(event.id, result));
        },
    });

    it.each(["original-event", "resolve-from-source-result"] as const)(
        "keeps etags in the source and lets the mirrors generate them when the mirrors own them (%s)",
        async (mirrorPersistPayloadMode) => {
            const sourceEvents: DbPluginBulkPersistEvent[] = [];
            const mirrorEvents: DbPluginBulkPersistEvent[] = [];
            const engine = new PluginSyncEngine({
                source: echoingPlugin(sourceEvents),
                mirrorPlugins: [echoingPlugin(mirrorEvents)],
                persistAckMode: "after-all",
                mirrorPersistPayloadMode,
                etagOwner: "mirrors",
            });

            await new Promise(resolve => engine.bulkPersist(versionedEvent(), resolve));

            expect([sourceEvents[0]?.etags, mirrorEvents[0]?.etags]).toEqual(["keep", "generate"]);
        }
    );

    it.each([
        [undefined, "mirror-resolved"],
        ["hydration", "hydration"],
    ])("gives a resolved mirror write the reason %p as %p", async (reason, expected) => {
        const mirrorEvents: DbPluginBulkPersistEvent[] = [];
        const engine = new PluginSyncEngine({
            source: echoingPlugin([]),
            mirrorPlugins: [echoingPlugin(mirrorEvents)],
            persistAckMode: "after-all",
            mirrorPersistPayloadMode: "resolve-from-source-result",
        });

        await new Promise(resolve => engine.bulkPersist({ ...versionedEvent(), reason }, resolve));

        expect(mirrorEvents[0]?.reason).toBe(expected);
    });

    it("sends the mirrors every row without its etag when the mirrors own them", async () => {
        const mirrorEvents: DbPluginBulkPersistEvent[] = [];
        const engine = new PluginSyncEngine({
            source: recordingPlugin([]),
            mirrorPlugins: [recordingPlugin(mirrorEvents)],
            persistAckMode: "after-all",
            etagOwner: "mirrors",
        });
        const event = versionedEvent();

        await new Promise(resolve => engine.bulkPersist(event, resolve));

        const mirrored = mirrorEvents[0]?.operation.get(versionedSchema.id);
        expect([mirrored?.adds, mirrored?.updates.map(update => update.entity), mirrored?.removes]).toEqual([
            [{ id: "a", name: "A" }],
            [{ id: "a", name: "A" }],
            [{ id: "a", name: "A" }],
        ]);
        expect(event.operation.get(versionedSchema.id)?.adds).toEqual([{ id: "a", name: "A", version: 4 }]);
    });

    it("passes through the changes of a schema without an etag when the mirrors own them", async () => {
        const mirrorEvents: DbPluginBulkPersistEvent[] = [];
        const engine = new PluginSyncEngine({
            source: recordingPlugin([]),
            mirrorPlugins: [recordingPlugin(mirrorEvents)],
            persistAckMode: "after-all",
            etagOwner: "mirrors",
        });
        const event = persistEvent();

        await new Promise(resolve => engine.bulkPersist(event, resolve));

        expect(mirrorEvents[0]?.operation.get(testSchema.id)).toBe(event.operation.get(testSchema.id));
    });

    const incrementingSource = (): IDbPlugin => ({
        ...recordingPlugin([]),
        bulkPersist: (event, done) => {
            const result = new BulkPersistResult();
            result.resolve<InferRoot<typeof versionedSchema>>(versionedSchema.id).updates.push({ id: "a", name: "A", version: 2 });
            done(PluginEventResult.success(event.id, result));
        },
    });

    const updateEvent = (): DbPluginBulkPersistEvent => {
        const operation = new BulkPersistChanges();
        operation.resolve<InferRoot<typeof versionedSchema>>(versionedSchema.id).updates.push({ entity: { id: "a", name: "A", version: 1 }, changeType: "markedDirty", delta: {} });
        return {
            id: "update-event",
            schemas: new SchemaCollection().set(versionedSchema.id, versionedSchema),
            source: "test",
            action: "persist",
            operation,
        };
    };

    it("gives the mirrors the etags the source generated, even from the original event", async () => {
        const mirrorEvents: DbPluginBulkPersistEvent[] = [];
        const engine = new PluginSyncEngine({
            source: incrementingSource(),
            mirrorPlugins: [recordingPlugin(mirrorEvents)],
            persistAckMode: "after-all",
            mirrorPersistPayloadMode: "original-event",
        });

        await new Promise(resolve => engine.bulkPersist(updateEvent(), resolve));

        expect(mirrorEvents[0]?.operation.get(versionedSchema.id)?.updates.map(update => update.entity)).toEqual([{ id: "a", name: "A", version: 2 }]);
        expect(mirrorEvents[0]?.etags).toBe("keep");
    });

    it("rebuilds the mirror payload from the source result when the mirrors own etags", async () => {
        const mirrorEvents: DbPluginBulkPersistEvent[] = [];
        const engine = new PluginSyncEngine({
            source: recordingPlugin([]),
            mirrorPlugins: [recordingPlugin(mirrorEvents)],
            persistAckMode: "after-all",
            mirrorPersistPayloadMode: "resolve-from-source-result",
            etagOwner: "mirrors",
        });

        await new Promise(resolve => engine.bulkPersist(persistEvent(), resolve));

        expect(mirrorEvents[0]?.operation.get(testSchema.id)?.adds).toEqual([{ id: "resolved", name: "Resolved" }]);
    });

    it("hands the mirrors the original event when no schema in it has an etag", async () => {
        const mirrorEvents: DbPluginBulkPersistEvent[] = [];
        const engine = new PluginSyncEngine({
            source: recordingPlugin([]),
            mirrorPlugins: [recordingPlugin(mirrorEvents)],
            persistAckMode: "after-all",
            mirrorPersistPayloadMode: "original-event",
        });
        const event = persistEvent();

        await new Promise(resolve => engine.bulkPersist(event, resolve));

        expect(mirrorEvents[0]?.operation).toBe(event.operation);
    });

    it("reports each successful mirror write with the event the mirror received", async () => {
        const persisted: [DbPluginBulkPersistEvent, BulkPersistResult][] = [];
        const mirrorEvents: DbPluginBulkPersistEvent[] = [];
        const engine = new PluginSyncEngine({
            source: echoingPlugin([]),
            mirrorPlugins: [echoingPlugin(mirrorEvents)],
            persistAckMode: "after-all",
            onMirrorPersisted: (event, result) => persisted.push([event, result]),
        });

        await new Promise(resolve => engine.bulkPersist(versionedEvent(), resolve));

        expect(persisted.map(([event]) => event)).toEqual(mirrorEvents);
        expect(persisted[0]?.[1]).toBeInstanceOf(BulkPersistResult);
    });

    it("does not report a mirror write that failed", async () => {
        const persisted: DbPluginBulkPersistEvent[] = [];
        const failing: IDbPlugin = {
            ...recordingPlugin([]),
            bulkPersist: (event, done) => done(PluginEventResult.error(event.id, new Error("mirror down"))),
        };
        const engine = new PluginSyncEngine({
            source: echoingPlugin([]),
            mirrorPlugins: [failing],
            persistAckMode: "after-all",
            onMirrorPersisted: (event) => persisted.push(event),
        });

        await new Promise(resolve => engine.bulkPersist(versionedEvent(), resolve));

        expect(persisted).toEqual([]);
    });
});
