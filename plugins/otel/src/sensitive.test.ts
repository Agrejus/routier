import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { uuidv4 } from "@routier/core";
import type { DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import type { PluginEventCallbackResult } from "@routier/core/results";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { OtelDbPlugin } from "./OtelDbPlugin";

const personSchema = s.define("otel_people", {
    id: s.string().key(),
    name: s.string(),
    ssn: s.string().sensitive(),
}).compile();

class InlineValuesPlugin extends MemoryPlugin {
    override query<TRoot extends {}, TShape = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        super.query(event, result => {
            event.executedQueries.splice(0, event.executedQueries.length, { text: "find {\"ssn\":\"123-45-6789\",\"name\":\"Ada\"}" });
            done(result);
        });
    }
}

class Store extends DataStore {
    people = this.collection(personSchema).proxy().create();
}

const queryText = async (run: (store: Store) => Promise<unknown>) => {
    const exporter = new InMemorySpanExporter();
    const tracer = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).getTracer("test");
    const store = new Store(new OtelDbPlugin(new InlineValuesPlugin(uuidv4()), tracer));

    await run(store);
    store[Symbol.dispose]();

    return exporter.getFinishedSpans().find(span => span.name === "routier.query")?.attributes["db.query.text"];
};

describe("db.query.text", () => {
    it("is hidden for a query that filters on a sensitive property", async () => {
        expect(await queryText(store => store.people.where(p => p.ssn === "123-45-6789").toArrayAsync())).toBe("[hidden: this query filters on a sensitive property]");
    });

    it("is kept for a query that does not", async () => {
        expect(await queryText(store => store.people.where(p => p.name === "Ada").toArrayAsync())).toContain("Ada");
    });
});
