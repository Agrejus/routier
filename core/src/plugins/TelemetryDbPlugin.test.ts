import { BulkPersistResult, SchemaCollection } from "../collections";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "../results";
import { s } from "../schema";
import { resetLogLevel, setLogLevel } from "../utilities";
import { collectingSink, TelemetryDbPlugin, TelemetryEvent } from "./TelemetryDbPlugin";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";

/**
 * The telemetry wrapper, against a plugin that succeeds or fails on demand.
 *
 * What matters is that measuring is invisible to the caller: one event per call, the result
 * handed back untouched, and a sink that throws swallowed rather than surfaced as a data error.
 */

const telemetryProducts = s.define("telemetry_products", {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

/** Counts calls and fails or partials on demand. */
class FlakyPlugin implements IDbPlugin {

    readonly databaseName = "test-db";

    queries = 0;
    persists = 0;
    destroys = 0;

    /** The exact result objects handed to `done`, for reference-identity assertions. */
    readonly produced: any[] = [];

    constructor(private readonly outcomes: {
        query?: "success" | "error",
        persist?: "success" | "error" | "partial",
    } = {}) { }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.queries++;

        const result = this.outcomes.query === "error"
            ? PluginEventResult.error<ITranslatedValue<TShape>>(event.id, new Error("query failure"))
            : PluginEventResult.success(event.id, {
                value: [`attempt-${this.queries}`],
                isTransformed: false,
                isEmpty: false,
                forEach: (): void => undefined,
            } as unknown as ITranslatedValue<TShape>);

        this.produced.push(result);
        done(result);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.persists++;

        const result = this.persistResult(event.id);

        this.produced.push(result);
        done(result);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.destroys++;

        const result = PluginEventResult.success(event.id, undefined as never);

        this.produced.push(result);
        done(result);
    }

    private persistResult(id: string) {
        if (this.outcomes.persist === "error") {
            return PluginEventResult.error<BulkPersistResult>(id, new Error("persist failure"));
        }

        if (this.outcomes.persist === "partial") {
            return PluginEventResult.partial(id, new BulkPersistResult(), new Error("persist partial"));
        }

        return PluginEventResult.success(id, new BulkPersistResult());
    }
}

const telemetryOrders = s.define("telemetry_orders", {
    id: s.string().key().identity(),
    total: s.number(),
}).compile();

const schemas = new SchemaCollection().set(telemetryProducts.id, telemetryProducts);

const twoSchemas = new SchemaCollection()
    .set(telemetryProducts.id, telemetryProducts)
    .set(telemetryOrders.id, telemetryOrders);

const queryEvent = { id: "q1", operation: {}, schemas, source: "test-query-source", action: "query" } as unknown as DbPluginQueryEvent<{}, {}>;
const twoSchemaQueryEvent = { ...queryEvent, schemas: twoSchemas } as unknown as DbPluginQueryEvent<{}, {}>;
const persistEvent = { id: "p1", operation: {}, schemas, source: "test-persist-source", action: "persist" } as unknown as DbPluginBulkPersistEvent;
const destroyEvent = { id: "d1", schemas, source: "test-destroy-source", action: "destroy" } as unknown as DbPluginEvent;

const runQuery = (plugin: TelemetryDbPlugin, event = queryEvent) =>
    new Promise<any>(resolve => plugin.query(event, resolve as never));

const runPersist = (plugin: TelemetryDbPlugin) =>
    new Promise<any>(resolve => plugin.bulkPersist(persistEvent, resolve as never));

const runDestroy = (plugin: TelemetryDbPlugin) =>
    new Promise<any>(resolve => plugin.destroy(destroyEvent, resolve as never));

const wrap = (inner: IDbPlugin, events: TelemetryEvent[]) =>
    new TelemetryDbPlugin(inner, { onEvent: collectingSink(events) });

describe("TelemetryDbPlugin", () => {

    it("forwards the inner plugin's database name", () => {
        const inner = new FlakyPlugin();

        expect(wrap(inner, []).databaseName).toBe(inner.databaseName);
    });

    it("emits one success event for a query", async () => {
        const events: TelemetryEvent[] = [];
        const before = performance.now();

        await runQuery(wrap(new FlakyPlugin(), events));

        expect(events.length).toBe(1);
        expect(events[0].operation).toBe("query");
        expect(events[0].ok).toBe("success");
        expect(events[0].eventId).toBe(queryEvent.id);
        expect(events[0].source).toBe(queryEvent.source);
        expect(events[0].error).toBeUndefined();

        // Bounded above as well as below: a duration built from the wrong arithmetic is still
        // a non-negative number, and only the upper bound says it is an elapsed time.
        expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
        expect(events[0].durationMs).toBeLessThanOrEqual(performance.now() - before);
    });

    it("never carries an error on a success", async () => {
        const inner = new FlakyPlugin();
        inner.query = ((event: any, done: any) => done({
            id: event.id,
            ok: "success",
            data: undefined,
            error: new Error("must not be reported"),
        })) as never;

        const events: TelemetryEvent[] = [];

        await runQuery(wrap(inner, events));

        expect(events[0].ok).toBe("success");
        expect(events[0].error).toBeUndefined();
    });

    it("records the inner error and still reports it to the caller", async () => {
        const events: TelemetryEvent[] = [];

        const result = await runQuery(wrap(new FlakyPlugin({ query: "error" }), events));

        expect(events.length).toBe(1);
        expect(events[0].ok).toBe("error");
        expect(String(events[0].error)).toContain("query failure");
        expect(result.ok).toBe(PluginEventResult.ERROR);
        expect(result.error).toBe(events[0].error);
    });

    it("emits one success event for a bulkPersist", async () => {
        const events: TelemetryEvent[] = [];

        await runPersist(wrap(new FlakyPlugin(), events));

        expect(events.length).toBe(1);
        expect(events[0].operation).toBe("bulkPersist");
        expect(events[0].ok).toBe("success");
    });

    it("carries the error of a partial save", async () => {
        const events: TelemetryEvent[] = [];

        await runPersist(wrap(new FlakyPlugin({ persist: "partial" }), events));

        expect(events.length).toBe(1);
        expect(events[0].ok).toBe("partial");
        expect(String(events[0].error)).toContain("persist partial");
    });

    it("emits an event for a destroy", async () => {
        const events: TelemetryEvent[] = [];

        await runDestroy(wrap(new FlakyPlugin(), events));

        expect(events.length).toBe(1);
        expect(events[0].operation).toBe("destroy");
        expect(events[0].ok).toBe("success");
    });

    it("hands back the inner result object itself, not a copy", async () => {
        const inner = new FlakyPlugin();
        const events: TelemetryEvent[] = [];
        const plugin = wrap(inner, events);

        const queryResult = await runQuery(plugin);
        const persistResult = await runPersist(plugin);
        const destroyResult = await runDestroy(plugin);

        // A copy would break change tracking downstream, which compares by reference.
        expect(queryResult).toBe(inner.produced[0]);
        expect(persistResult).toBe(inner.produced[1]);
        expect(destroyResult).toBe(inner.produced[2]);
    });

    it("swallows a sink that throws", async () => {
        const inner = new FlakyPlugin();
        const plugin = new TelemetryDbPlugin(inner, {
            onEvent: () => { throw new Error("sink exploded"); },
        });

        const result = await runQuery(plugin);

        // Observability is never worth failing a data operation over.
        expect(result).toBe(inner.produced[0]);
        expect(result.ok).toBe(PluginEventResult.SUCCESS);
    });

    it("writes through the levelled logger when no sink is supplied", async () => {
        const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
        setLogLevel("info");

        try {
            await runQuery(new TelemetryDbPlugin(new FlakyPlugin()));

            await runQuery(new TelemetryDbPlugin(new FlakyPlugin()), twoSchemaQueryEvent);

            expect(info).toHaveBeenCalledTimes(2);
            expect(String(info.mock.calls[0][0])).toContain("[routier] query telemetry_products");
            expect(String(info.mock.calls[1][0])).toContain("[routier] query telemetry_products,telemetry_orders");
        } finally {
            resetLogLevel();
            info.mockRestore();
        }
    });

    it("writes an error through the logger at error level", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
        setLogLevel("error");

        try {
            await runQuery(new TelemetryDbPlugin(new FlakyPlugin({ query: "error" })));

            expect(error).toHaveBeenCalledTimes(1);
            expect(String(error.mock.calls[0][1])).toContain("query failure");
        } finally {
            resetLogLevel();
            error.mockRestore();
        }
    });

    it("names every collection the event touched", async () => {
        const events: TelemetryEvent[] = [];

        await runQuery(wrap(new FlakyPlugin(), events));

        expect(events[0].schemas).toEqual([telemetryProducts.collectionName]);
    });

    it("emits exactly once per call", async () => {
        const events: TelemetryEvent[] = [];
        const plugin = wrap(new FlakyPlugin(), events);

        await runQuery(plugin);
        expect(events.length).toBe(1);

        await runQuery(plugin);
        await runQuery(plugin);
        expect(events.length).toBe(3);
    });
});
