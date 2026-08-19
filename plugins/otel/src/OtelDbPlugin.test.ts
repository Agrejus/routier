import { context, SpanStatusCode, trace, type Tracer } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { BulkPersistResult, SchemaCollection } from "@routier/core/collections";
import {
    DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, ExecutedQuery, IDbPlugin, ITranslatedValue,
} from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "@routier/core/results";
import { s } from "@routier/core/schema";
import { OtelDbPlugin } from "./OtelDbPlugin";

/**
 * The tracing wrapper, against a real in-memory OTel pipeline.
 *
 * `context.with` only propagates when a context manager is installed — without the one below
 * every span would be a root and the nesting assertion would pass vacuously.
 */

const otelProducts = s.define("otel_products", {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

/** Succeeds, fails or partials on demand, and can run work inside the wrapper's span. */
class FakePlugin implements IDbPlugin {

    readonly databaseName = "otel-test-db";

    /** The exact result objects handed to `done`, for reference-identity assertions. */
    readonly produced: any[] = [];

    /** Ran inside `query`, so a caller can observe the active context. */
    onQuery?: (event: DbPluginQueryEvent<any, any>) => void;

    constructor(private readonly outcomes: {
        query?: "success" | "error",
        persist?: "success" | "error" | "partial",
    } = {}) { }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.onQuery?.(event);

        const result = this.outcomes.query === "error"
            ? PluginEventResult.error<ITranslatedValue<TShape>>(event.id, new Error("query failure"))
            : PluginEventResult.success(event.id, [] as unknown as ITranslatedValue<TShape>);

        this.produced.push(result);
        done(result);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        const result = this.persistResult(event.id);

        this.produced.push(result);
        done(result);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
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

const otelOrders = s.define("otel_orders", {
    id: s.string().key().identity(),
    total: s.number(),
}).compile();

const schemas = new SchemaCollection().set(otelProducts.id, otelProducts);

const twoSchemas = new SchemaCollection()
    .set(otelProducts.id, otelProducts)
    .set(otelOrders.id, otelOrders);

const queryEvent = (executedQueries: ExecutedQuery[] = []) =>
    ({ id: "q1", operation: {}, schemas, source: "test-query-source", action: "query", explain: false, executedQueries } as unknown as DbPluginQueryEvent<{}, {}>);

const persistEvent = { id: "p1", operation: {}, schemas, source: "test-persist-source", action: "persist" } as unknown as DbPluginBulkPersistEvent;
const destroyEvent = { id: "d1", schemas, source: "test-destroy-source", action: "destroy" } as unknown as DbPluginEvent;

let exporter: InMemorySpanExporter;
let tracer: Tracer;

const runQuery = (plugin: OtelDbPlugin, event = queryEvent()) =>
    new Promise<any>(resolve => plugin.query(event, resolve as never));

const runPersist = (plugin: OtelDbPlugin) =>
    new Promise<any>(resolve => plugin.bulkPersist(persistEvent, resolve as never));

const runDestroy = (plugin: OtelDbPlugin) =>
    new Promise<any>(resolve => plugin.destroy(destroyEvent, resolve as never));

const spanNamed = (name: string) => exporter.getFinishedSpans().filter(x => x.name === name);

beforeAll(() => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
});

beforeEach(() => {
    exporter = new InMemorySpanExporter();
    tracer = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).getTracer("test");
});

describe("OtelDbPlugin", () => {

    it("forwards the inner plugin's database name", () => {
        const inner = new FakePlugin();

        expect(new OtelDbPlugin(inner, tracer).databaseName).toBe(inner.databaseName);
    });

    it("traces a successful query", async () => {
        await runQuery(new OtelDbPlugin(new FakePlugin(), tracer));

        const spans = spanNamed("routier.query");

        expect(spans.length).toBe(1);
        expect(spans[0].status.code).not.toBe(SpanStatusCode.ERROR);
        expect(spans[0].attributes["db.system"]).toBe("otel-test-db");
        expect(spans[0].attributes["db.collection.name"]).toBe(otelProducts.collectionName);
        expect(spans[0].attributes["routier.source"]).toBe("test-query-source");
        expect(spans[0].attributes["routier.event.id"]).toBe("q1");
    });

    it("marks a failed query as an error and records the exception", async () => {
        await runQuery(new OtelDbPlugin(new FakePlugin({ query: "error" }), tracer));

        const [span] = spanNamed("routier.query");

        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.events.length).toBe(1);
        expect(span.events[0].name).toBe("exception");
    });

    it("traces a successful bulkPersist", async () => {
        await runPersist(new OtelDbPlugin(new FakePlugin(), tracer));

        const spans = spanNamed("routier.bulkPersist");

        expect(spans.length).toBe(1);
        expect(spans[0].status.code).not.toBe(SpanStatusCode.ERROR);
    });

    it("marks a partial save as an error", async () => {
        await runPersist(new OtelDbPlugin(new FakePlugin({ persist: "partial" }), tracer));

        const [span] = spanNamed("routier.bulkPersist");

        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.status.message).toBe("partial");
        expect(span.events.length).toBe(1);
    });

    it("traces a destroy", async () => {
        await runDestroy(new OtelDbPlugin(new FakePlugin(), tracer));

        expect(spanNamed("routier.destroy").length).toBe(1);
    });

    it("records what the inner plugin reported executing", async () => {
        const event = queryEvent();
        const inner = new FakePlugin();
        inner.onQuery = e => e.executedQueries.push({ text: "SELECT 1" });

        await runQuery(new OtelDbPlugin(inner, tracer), event);

        expect(spanNamed("routier.query")[0].attributes["db.query.text"]).toBe("SELECT 1");
    });

    it("joins several reported statements into one attribute", async () => {
        const inner = new FakePlugin();
        inner.onQuery = e => { e.executedQueries.push({ text: "SELECT 1" }, { text: "SELECT 2" }); };

        await runQuery(new OtelDbPlugin(inner, tracer));

        expect(spanNamed("routier.query")[0].attributes["db.query.text"]).toBe("SELECT 1; SELECT 2");
    });

    it("leaves the query text unset when the plugin reported nothing", async () => {
        await runQuery(new OtelDbPlugin(new FakePlugin(), tracer));

        expect(spanNamed("routier.query")[0].attributes["db.query.text"]).toBeUndefined();
    });

    it("nests the inner plugin's own spans under the operation span", async () => {
        const inner = new FakePlugin();
        inner.onQuery = () => { tracer.startSpan("child").end(); };

        await runQuery(new OtelDbPlugin(inner, tracer));

        const [child] = spanNamed("child");
        const [parent] = spanNamed("routier.query");

        expect(child.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
    });

    it("hands back the inner result object itself, not a copy", async () => {
        const inner = new FakePlugin();
        const plugin = new OtelDbPlugin(inner, tracer);

        const queryResult = await runQuery(plugin);
        const persistResult = await runPersist(plugin);
        const destroyResult = await runDestroy(plugin);

        expect(queryResult).toBe(inner.produced[0]);
        expect(persistResult).toBe(inner.produced[1]);
        expect(destroyResult).toBe(inner.produced[2]);
    });

    it("names every collection the operation touched", async () => {
        const event = { ...queryEvent(), schemas: twoSchemas } as unknown as DbPluginQueryEvent<{}, {}>;

        await runQuery(new OtelDbPlugin(new FakePlugin(), tracer), event);

        expect(spanNamed("routier.query")[0].attributes["db.collection.name"])
            .toBe(`${otelProducts.collectionName},${otelOrders.collectionName}`);
    });

    it("falls back to a tracer named routier when none is supplied", async () => {
        const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
        trace.setGlobalTracerProvider(provider);

        try {
            const inner = new FakePlugin();

            const result = await runQuery(new OtelDbPlugin(inner));

            expect(result).toBe(inner.produced[0]);
            expect(spanNamed("routier.query")[0].instrumentationScope.name).toBe("routier");
        } finally {
            trace.disable();
        }
    });

    it("records a non-Error failure as a string", async () => {
        const inner = new FakePlugin();
        inner.query = ((event: any, done: any) => done(PluginEventResult.error(event.id, "plain string failure"))) as never;

        await runQuery(new OtelDbPlugin(inner, tracer));

        const [span] = spanNamed("routier.query");

        expect(span.status.code).toBe(SpanStatusCode.ERROR);
        expect(span.events[0].attributes?.["exception.message"]).toContain("plain string failure");
    });

    it("ends the span even with no schemas and a failure", async () => {
        const event = { ...queryEvent(), schemas: new SchemaCollection() } as unknown as DbPluginQueryEvent<{}, {}>;

        await runQuery(new OtelDbPlugin(new FakePlugin({ query: "error" }), tracer), event);

        // An exporter only ever receives ended spans, so receiving it is the assertion.
        const [span] = spanNamed("routier.query");

        expect(span.attributes["db.collection.name"]).toBe("");
        expect(span.status.code).toBe(SpanStatusCode.ERROR);
    });

    it("ends the span when the bookkeeping itself throws", async () => {
        const inner = new FakePlugin();
        inner.onQuery = e => {
            Object.defineProperty(e, "executedQueries", {
                get() { throw new Error("bookkeeping exploded"); },
            });
        };

        const result = await runQuery(new OtelDbPlugin(inner, tracer));

        expect(result).toBe(inner.produced[0]);
        expect(spanNamed("routier.query").length).toBe(1);
    });
});
