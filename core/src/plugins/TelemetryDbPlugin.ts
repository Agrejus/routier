import { BulkPersistResult } from "../collections";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "../results";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";
import { logger } from "../utilities";

/**
 * Measures every operation an inner plugin performs and hands one event per call to a sink.
 *
 * ```ts
 * const store = new MyStore(new TelemetryDbPlugin(new SomeDbPlugin(...)));
 * ```
 */

export type TelemetryEvent = {
    operation: "query" | "bulkPersist" | "destroy";
    /** `id` of the plugin event that produced this measurement. */
    eventId: string;
    /** The class/component that triggered the operation (`event.source`). */
    source: string;
    /** Collection names involved, from `event.schemas`. */
    schemas: string[];
    durationMs: number;
    ok: "success" | "partial" | "error";
    /** Present when ok is "error" or "partial". */
    error?: unknown;
};

export type TelemetrySink = (e: TelemetryEvent) => void;

export type TelemetryDbPluginOptions = {
    /** Where events go. Default: `loggerSink()`. */
    onEvent?: TelemetrySink;
};

/** Default sink: writes through the levelled logger, so ROUTIER_LOG_LEVEL governs it. */
export const loggerSink = (): TelemetrySink => e => {
    const line = `[routier] ${e.operation} ${e.schemas.join(",")} ${e.durationMs.toFixed(1)}ms`;

    if (e.ok === "error") {
        logger.error(line, e.error);
        return;
    }

    logger.info(line);
};

/** Pushes every event into `into`. For tests and custom buffering. */
export const collectingSink = (into: TelemetryEvent[]): TelemetrySink => e => {
    into.push(e);
};

export class TelemetryDbPlugin implements IDbPlugin {

    private readonly plugin: IDbPlugin;
    private readonly onEvent: TelemetrySink;

    constructor(plugin: IDbPlugin, options: TelemetryDbPluginOptions = {}) {
        this.plugin = plugin;
        this.onEvent = options.onEvent ?? loggerSink();
    }

    get databaseName(): string {
        return this.plugin.databaseName;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const start = performance.now();

        this.plugin.query<TRoot, TShape>(event, result => {
            this.emit("query", event, result, start);
            done(result);
        });
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        const start = performance.now();

        this.plugin.bulkPersist(event, result => {
            this.emit("bulkPersist", event, result, start);
            done(result);
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        const start = performance.now();

        this.plugin.destroy(event, result => {
            this.emit("destroy", event, result, start);
            done(result);
        });
    }

    private emit(
        operation: TelemetryEvent["operation"],
        event: DbPluginEvent,
        result: { ok: "success" | "partial" | "error"; error?: unknown },
        start: number
    ): void {
        try {
            this.onEvent({
                operation,
                eventId: event.id,
                source: event.source,
                schemas: [...event.schemas.values()].map(s => s.collectionName),
                durationMs: performance.now() - start,
                ok: result.ok,
                error: result.ok === "success" ? undefined : (result as { error?: unknown }).error,
            });
        } catch {
            // A broken sink must never fail the data operation.
        }
    }
}
