import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { uuidv4 } from "@routier/core";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import { OtelDbPlugin } from "./OtelDbPlugin";

/**
 * The wrapper against the real memory plugin. This package holds the test rather than
 * `plugins/memory` so the memory plugin stays free of an OTel devDependency.
 */

const widgetSchema = s.define("otel_widgets", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

class WidgetStore extends DataStore {
    widgets = this.collection(widgetSchema).proxy().create();
}

describe("OtelDbPlugin acceptance", () => {

    it("traces a real save and query without changing their results", async () => {
        const exporter = new InMemorySpanExporter();
        const tracer = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).getTracer("test");
        const store = new WidgetStore(new OtelDbPlugin(new MemoryPlugin(uuidv4()), tracer));

        const [added] = await store.widgets.addAsync({ name: "sprocket", price: 12 });
        const response = await store.saveChangesAsync();
        const found = await store.widgets.toArrayAsync();

        const names = exporter.getFinishedSpans().map(x => x.name);

        expect(names).toContain("routier.bulkPersist");
        expect(names).toContain("routier.query");

        expect(response.aggregate.size).toBe(1);
        expect(added.id).toStrictEqual(expect.any(String));
        expect(added.name).toBe("sprocket");
        expect(found.length).toBe(1);
        expect(found[0].id).toBe(added.id);
        expect(found[0].price).toBe(12);

        const persist = exporter.getFinishedSpans().find(x => x.name === "routier.bulkPersist");

        expect(persist?.attributes["db.collection.name"]).toBe(widgetSchema.collectionName);

        await store.destroyAsync();

        expect(exporter.getFinishedSpans().map(x => x.name)).toContain("routier.destroy");
    });
});
