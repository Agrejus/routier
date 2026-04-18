import type {
    IDbPlugin,
    DbPluginEvent,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    ITranslatedValue,
} from "@routier/core/plugins";
import type {
    PluginEventCallbackPartialResult,
    PluginEventCallbackResult,
    PluginEventPartialResultType,
    PluginEventResultType,
    PluginEventSuccessType,
} from "@routier/core/results";
import { PluginEventResult, Result } from "@routier/core/results";
import type { BulkPersistResult } from "@routier/core/collections";
import { BulkPersistChanges } from "@routier/core/collections";
import { logger, resolveBulkPersistChanges } from "@routier/core/utilities";

export type QueryFailureMode = "surface-first" | "surface-last";
export type MirrorFailureMode = "surface" | "swallow";
export type PersistAckMode = "after-source" | "after-all";
export type DestroyFailureMode = "surface-first" | "surface-last" | "swallow";
export type MirrorPersistPayloadMode = "original-event" | "resolve-from-source-result";

export type PluginSyncEngineOptions = {
    /** Primary read/write plugin. */
    source: IDbPlugin;
    /**
     * Optional ordered list of plugins to try for reads.
     * If omitted, reads use source.
     * @default [source]
     */
    queryPlugins?: IDbPlugin[];
    /**
     * Plugins that should receive mirrored writes after source succeeds.
     * Typical use: write-through from local store to remote sync plugin.
     * @default []
     */
    mirrorPlugins?: IDbPlugin[];
    /**
     * Whether to report success to caller after source only, or after all mirrors settle.
     * - after-source: low-latency optimistic ack.
     * - after-all: transactional-style ack across composition.
     * @default "after-source"
     */
    persistAckMode?: PersistAckMode;
    /**
     * How mirror failures are handled.
     * - swallow: keep success from source and emit hook/log.
     * - surface: fail operation (only meaningful with ackMode=after-all).
     * @default "swallow"
     */
    mirrorFailureMode?: MirrorFailureMode;
    /**
     * When all query routes fail, choose which error to surface.
     * @default "surface-last"
     */
    queryFailureMode?: QueryFailureMode;
    /**
     * Destroy error policy across composed plugins.
     * @default "surface-last"
     */
    destroyFailureMode?: DestroyFailureMode;
    /**
     * Optional hook for swallowed mirror failures (after-source or swallow mode).
     * @default undefined
     */
    onMirrorError?: (error: Error, context: { pluginIndex: number; eventId: string }) => void;
    /**
     * Strategy for payload sent to mirror plugins during bulkPersist.
     * - original-event: mirrors receive the same operation payload.
     * - resolve-from-source-result: mirror payload is rebuilt with resolveBulkPersistChanges(...),
     *   useful when source generated ids must be mirrored downstream.
     * @default "original-event"
     */
    mirrorPersistPayloadMode?: MirrorPersistPayloadMode;
};

export class PluginSyncEngine implements IDbPlugin {
    private readonly source: IDbPlugin;
    private readonly queryPlugins: IDbPlugin[];
    private readonly mirrorPlugins: IDbPlugin[];
    private readonly persistAckMode: PersistAckMode;
    private readonly mirrorFailureMode: MirrorFailureMode;
    private readonly queryFailureMode: QueryFailureMode;
    private readonly destroyFailureMode: DestroyFailureMode;
    private readonly onMirrorError?: (error: Error, context: { pluginIndex: number; eventId: string }) => void;
    private readonly mirrorPersistPayloadMode: MirrorPersistPayloadMode;

    constructor(options: PluginSyncEngineOptions) {
        this.source = options.source;
        this.queryPlugins = options.queryPlugins?.length ? options.queryPlugins : [options.source];
        this.mirrorPlugins = options.mirrorPlugins ?? [];
        this.persistAckMode = options.persistAckMode ?? "after-source";
        this.mirrorFailureMode = options.mirrorFailureMode ?? "swallow";
        this.queryFailureMode = options.queryFailureMode ?? "surface-last";
        this.destroyFailureMode = options.destroyFailureMode ?? "surface-last";
        this.onMirrorError = options.onMirrorError;
        this.mirrorPersistPayloadMode = options.mirrorPersistPayloadMode ?? "original-event";

        if (this.persistAckMode === "after-source" && this.mirrorFailureMode === "surface") {
            logger.warn("[PluginSyncEngine] mirrorFailureMode=surface has no synchronous effect when persistAckMode=after-source; mirror failures are observed via onMirrorError/logging.");
        }
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.queryAsync(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.bulkPersistAsync(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.destroyAsync(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    private async queryAsync<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ) {
        const errors: Error[] = [];

        for (let i = 0; i < this.queryPlugins.length; i++) {
            const plugin = this.queryPlugins[i];
            const result = await this.queryPlugin(plugin, event);

            if (result.ok === Result.SUCCESS) {
                done(result);
                return;
            }

            const error = this.toError(result.error);
            errors.push(error);
            logger.warn("[PluginSyncEngine] query route failed", { routeIndex: i, eventId: event.id, error });
        }

        const fallbackError =
            this.queryFailureMode === "surface-first"
                ? errors[0]
                : errors[errors.length - 1];

        done(PluginEventResult.error(event.id, fallbackError ?? new Error("Query failed in all routes.")));
    }

    private async bulkPersistAsync(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ) {
        const sourceResult = await this.persistPlugin(this.source, event);

        if (sourceResult.ok !== Result.SUCCESS) {
            done(sourceResult);
            return;
        }

        if (this.mirrorPlugins.length === 0) {
            done(sourceResult);
            return;
        }

        const mirrorTasks = this.mirrorPlugins.map((plugin, pluginIndex) => {
            const mirrorEvent = this.buildMirrorEvent(event, sourceResult);

            return this.persistPlugin(plugin, mirrorEvent).then((result) => ({ pluginIndex, result }));
        });

        if (this.persistAckMode === "after-source") {
            // Return optimistic success quickly; mirrors complete in background.
            done(sourceResult);
            void Promise.allSettled(mirrorTasks).then((outcomes) => {
                outcomes.forEach((outcome) => {
                    if (outcome.status === "fulfilled" && outcome.value.result.ok !== Result.SUCCESS) {
                        this.reportMirrorError(outcome.value.result.error, outcome.value.pluginIndex, event.id);
                    }
                    if (outcome.status === "rejected") {
                        this.reportMirrorError(outcome.reason, -1, event.id);
                    }
                });
            });
            return;
        }

        // after-all mode
        const mirrorResults = await Promise.allSettled(mirrorTasks);
        const errors: Error[] = [];
        mirrorResults.forEach((outcome) => {
            if (outcome.status === "rejected") {
                errors.push(this.toError(outcome.reason));
                return;
            }

            if (outcome.value.result.ok !== Result.SUCCESS) {
                errors.push(this.toError(outcome.value.result.error));
            }
        });

        if (errors.length > 0) {
            if (this.mirrorFailureMode === "swallow") {
                errors.forEach((err, idx) => this.reportMirrorError(err, idx, event.id));
                done(sourceResult);
                return;
            }

            done(PluginEventResult.error(event.id, errors[0]));
            return;
        }

        done(sourceResult);
    }

    private async destroyAsync(event: DbPluginEvent, done: PluginEventCallbackResult<never>) {
        const plugins = this.uniquePlugins();
        const results = await Promise.allSettled(plugins.map((plugin) => this.destroyPlugin(plugin, event)));
        const errors: Error[] = [];

        results.forEach((result) => {
            if (result.status === "rejected") {
                errors.push(this.toError(result.reason));
                return;
            }

            if (result.value.ok === Result.ERROR) {
                errors.push(this.toError(result.value.error));
            }
        });

        if (errors.length === 0 || this.destroyFailureMode === "swallow") {
            done(PluginEventResult.success(event.id));
            return;
        }

        if (this.destroyFailureMode === "surface-first") {
            done(PluginEventResult.error(event.id, errors[0]));
            return;
        }

        done(PluginEventResult.error(event.id, errors[errors.length - 1]));
    }

    private uniquePlugins(): IDbPlugin[] {
        const set = new Set<IDbPlugin>();
        set.add(this.source);
        this.queryPlugins.forEach((p) => set.add(p));
        this.mirrorPlugins.forEach((p) => set.add(p));
        return [...set];
    }

    private reportMirrorError(error: unknown, pluginIndex: number, eventId: string) {
        const resolved = this.toError(error);
        logger.warn("[PluginSyncEngine] mirror persist failed", { pluginIndex, eventId, error: resolved });
        try {
            this.onMirrorError?.(resolved, { pluginIndex, eventId });
        } catch (hookError) {
            logger.error("[PluginSyncEngine] onMirrorError hook threw", { error: hookError });
        }
    }

    private toError(error: unknown): Error {
        return error instanceof Error ? error : new Error(String(error));
    }

    private buildMirrorEvent(
        event: DbPluginBulkPersistEvent,
        sourceResult: PluginEventSuccessType<BulkPersistResult>
    ): DbPluginBulkPersistEvent {
        if (this.mirrorPersistPayloadMode === "original-event") {
            return event;
        }

        const resolvedChanges = new BulkPersistChanges();
        resolveBulkPersistChanges(event, sourceResult.data, resolvedChanges);

        return {
            ...event,
            operation: resolvedChanges,
            reason: event.reason ?? "mirror-resolved",
        };
    }

    private queryPlugin<TRoot extends {}, TShape extends any = TRoot>(
        plugin: IDbPlugin,
        event: DbPluginQueryEvent<TRoot, TShape>
    ): Promise<PluginEventResultType<ITranslatedValue<TShape>>> {
        return new Promise((resolve) => {
            plugin.query(event, (result) => resolve(result));
        });
    }

    private persistPlugin(
        plugin: IDbPlugin,
        event: DbPluginBulkPersistEvent
    ): Promise<PluginEventPartialResultType<BulkPersistResult>> {
        return new Promise((resolve) => {
            plugin.bulkPersist(event, (result) => resolve(result));
        });
    }

    private destroyPlugin(plugin: IDbPlugin, event: DbPluginEvent): Promise<PluginEventResultType<never>> {
        return new Promise((resolve) => {
            plugin.destroy(event, (result) => resolve(result));
        });
    }
}

