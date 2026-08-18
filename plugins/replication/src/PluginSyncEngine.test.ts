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
import { BulkPersistChanges } from "@routier/core/collections";
import { s } from "@routier/core/schema";
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
        operation: {
            toResult: () => new Map(),
        } as any,
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
    it("reports the failing mirror's index, not the error-array index", (done) => {
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
            const [, context] = onMirrorError.mock.calls[0] as [Error, { pluginIndex: number }];
            expect(context.pluginIndex).toBe(1);
            done();
        });
    });
});
