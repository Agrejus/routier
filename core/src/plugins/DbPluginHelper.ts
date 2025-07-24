import { Result } from "../common/Result";
import { TrampolinePipeline } from "../common/TrampolinePipeline";
import { CompiledSchema, SchemaId } from "../schema";
import { CallbackResult } from "../types";
import { assertIsArray } from "../utilities";
import { DbPluginQueryEvent, IDbPlugin, IQuery } from "./types";

type ForEachPayload<TEntity extends {}, TShape extends unknown = TEntity> = {
    event: DbPluginQueryEvent<TEntity, TShape>,
    results: TShape,
    error?: any
}

export class DbPluginHelper {

    private readonly plugin: IDbPlugin;

    constructor(plugin: IDbPlugin) {
        this.plugin = plugin;
    }

    private _pipelineQuery<TEntity extends {}, TShape extends unknown = TEntity>(payload: ForEachPayload<TEntity, TShape>, done: (data: ForEachPayload<TEntity, TShape>, error?: any) => void): void {

        const { event, results } = payload;
        this.plugin.query(event, (result) => {

            if (result.ok === Result.ERROR) {
                // any error will terminate the pipeline
                done(payload, result.error);
                return;
            }

            assertIsArray(result.data);
            assertIsArray(results);

            if (result.data == null) {
                done(payload);
                return;
            }

            if (Array.isArray(result.data)) {
                results.push(...result.data);
            } else {
                results.push(result.data);
            }

            done(payload);
        })
    }

    resolveRemovalQueries<T extends {}>(schemas: Map<SchemaId, CompiledSchema<T>>, queries: IQuery<T, T>[], done: CallbackResult<T[]>) {

        if (queries.length === 0) {
            done(Result.success([]));
            return;
        }

        const pipeline = new TrampolinePipeline<ForEachPayload<T, T>>();

        for (let i = 0, length = queries.length; i < length; i++) {
            const query = queries[i];
            const queryEvent: DbPluginQueryEvent<T, T> = {
                schemas,
                operation: query
            }

            pipeline.pipe((payload, done) => this._pipelineQuery<T, T>({
                event: queryEvent,
                results: payload.results
            }, done));
        }

        pipeline.filter<ForEachPayload<T, T[]>>({
            event: null,
            results: [] as any
        }, (r, e) => {

            if (e || r.error != null) {
                done(Result.error(e ?? r.error));
                return;
            }

            done(Result.success(r.results));
        })
    }
}