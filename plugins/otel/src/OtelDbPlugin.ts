import { context, SpanStatusCode, trace, type Span, type Tracer } from "@opentelemetry/api";
import { BulkPersistResult } from "@routier/core/collections";
import {
    DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue,
} from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "@routier/core/results";

/**
 * Traces every operation an inner plugin performs as an OpenTelemetry span.
 *
 * ```ts
 * const store = new MyStore(new OtelDbPlugin(new SomeDbPlugin(...)));
 * ```
 */

const TRACER_NAME = "routier";

export class OtelDbPlugin implements IDbPlugin {

    private readonly plugin: IDbPlugin;
    private readonly tracer: Tracer;

    constructor(plugin: IDbPlugin, tracer?: Tracer) {
        this.plugin = plugin;
        this.tracer = tracer ?? trace.getTracer(TRACER_NAME);
    }

    get databaseName(): string {
        return this.plugin.databaseName;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const span = this.start("routier.query", event);

        context.with(trace.setSpan(context.active(), span), () => {
            this.plugin.query<TRoot, TShape>(event, result => {
                this.finish(span, result, () => {
                    if (event.executedQueries.length > 0) {
                        span.setAttribute("db.query.text", event.executedQueries.map(q => q.text).join("; "));
                    }
                });

                done(result);
            });
        });
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        const span = this.start("routier.bulkPersist", event);

        context.with(trace.setSpan(context.active(), span), () => {
            this.plugin.bulkPersist(event, result => {
                this.finish(span, result);
                done(result);
            });
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        const span = this.start("routier.destroy", event);

        context.with(trace.setSpan(context.active(), span), () => {
            this.plugin.destroy(event, result => {
                this.finish(span, result);
                done(result);
            });
        });
    }

    private start(name: string, event: DbPluginEvent): Span {
        return this.tracer.startSpan(name, {
            attributes: {
                "db.system": this.plugin.databaseName,
                "db.collection.name": [...event.schemas.values()].map(s => s.collectionName).join(","),
                "routier.source": event.source,
                "routier.event.id": event.id,
            },
        });
    }

    private finish(
        span: Span,
        result: { ok: "success" | "partial" | "error"; error?: unknown },
        extra?: () => void
    ): void {
        try {
            extra?.();

            if (result.ok === "error") {
                recordException(span, result.error);
                span.setStatus({ code: SpanStatusCode.ERROR });
            } else if (result.ok === "partial") {
                recordException(span, result.error);
                span.setStatus({ code: SpanStatusCode.ERROR, message: "partial" });
            }
        } catch {
            // Bookkeeping must never fail the data operation, and the span still ends below.
        }

        span.end();
    }
}

const recordException = (span: Span, error: unknown): void => {
    span.recordException(error instanceof Error ? error : String(error));
};
